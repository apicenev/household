import { TrashIcon } from "@heroicons/react/20/solid";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useIsDesktop } from "../../hooks/useMediaQuery";
import { useAuth } from "../../lib/auth/useAuth";
import { actions as actionLabels, calendarCopy } from "../../lib/copy";
import { GENERIC_WRITE_ERROR } from "../../lib/firestoreErrors";
import { useLoadedHousehold } from "../../lib/household/useHousehold";
import { createEvent, deleteEvent, updateEvent } from "../../services/eventService";
import type { CalendarEvent } from "../../types";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/toastContext";
import {
  CalendarContext,
  useCalendar,
  type CalendarActions,
  type CalendarContextValue,
  type NewEventOptions,
} from "./calendarContext";
import { EventForm } from "./EventForm";
import {
  eventChanges,
  eventInput,
  initialEventFormValues,
  validateEventForm,
  type EventFormValues,
} from "./eventFormValues";

/** How long a rejection waits before it looks at the event (as Phase 3 D21). */
const REJECTION_SETTLE_MS = 300;

type SheetState =
  | { mode: "new"; options: NewEventOptions }
  | { mode: "edit"; eventId: string; onDeleted?: () => void };

/**
 * Calendar writes plus the one shared Termin-Sheet and delete confirmation (6.8) for the
 * whole shell of a loaded household, so the Kalender page and the Schnellerfassung share them
 * (like TaskProvider and ShoppingProvider).
 */
export function CalendarProvider({ children }: { children: ReactNode }) {
  const { actions, deletedHere } = useCalendarWriter();
  const { members } = useLoadedHousehold();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  // Bumped on every open, so the form starts from fresh values.
  const [sheetKey, setSheetKey] = useState(0);
  const [deleting, setDeleting] = useState<{
    event: CalendarEvent;
    onDeleted?: () => void;
  } | null>(null);

  const openNewEvent = useCallback((options: NewEventOptions = {}) => {
    setSheet({ mode: "new", options });
    setSheetKey((key) => key + 1);
  }, []);
  const openEditEvent = useCallback((eventId: string, onDeleted?: () => void) => {
    setSheet({ mode: "edit", eventId, onDeleted });
    setSheetKey((key) => key + 1);
  }, []);
  const closeSheet = useCallback(() => setSheet(null), []);
  const confirmDelete = useCallback(
    (event: CalendarEvent, onDeleted?: () => void) => setDeleting({ event, onDeleted }),
    [],
  );

  const value = useMemo<CalendarContextValue>(
    () => ({ actions, openNewEvent, openEditEvent, confirmDelete, deletedHere }),
    [actions, openNewEvent, openEditEvent, confirmDelete, deletedHere],
  );

  return (
    <CalendarContext.Provider value={value}>
      {children}
      <EventSheet
        key={sheetKey}
        state={sheet}
        onClose={closeSheet}
        onDelete={(event) =>
          confirmDelete(event, sheet?.mode === "edit" ? sheet.onDeleted : undefined)
        }
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          // Close the sheet first, so its «deleted elsewhere» check doesn't fire (D52).
          setSheet(null);
          deleting.onDeleted?.();
          actions.remove(deleting.event);
          setDeleting(null);
        }}
        title={deleting ? calendarCopy.deleteTitle(deleting.event.title) : ""}
        text={calendarCopy.deleteText(members.map((member) => member.displayName))}
        confirmLabel={actionLabels.delete}
      />
    </CalendarContext.Provider>
  );
}

/**
 * Event writes for the UI. They don't wait for the server: the listener shows the change at
 * once, only a rejection is reported (D21 pattern); an edit of an event that's gone meanwhile
 * reports «Dieser Termin wurde gelöscht.», a delete of one is silent. Remembers the events
 * deleted on this device, so views don't report them as deleted elsewhere (D52).
 */
function useCalendarWriter(): {
  actions: CalendarActions;
  deletedHere: (eventId: string) => boolean;
} {
  const { household, events } = useLoadedHousehold();
  const { user } = useAuth();
  const toast = useToast();
  const uid = user?.uid ?? "";
  const householdId = household.id;

  const latest = useRef(events);
  const deleted = useRef(new Set<string>());
  const deletedHere = useCallback((eventId: string) => deleted.current.has(eventId), []);
  useEffect(() => {
    latest.current = events;
  }, [events]);

  const report = useCallback(
    (promise: Promise<void>, eventId: string, intent: "create" | "edit" | "delete") => {
      promise.catch(() => {
        window.setTimeout(() => {
          const exists = latest.current.some((event) => event.id === eventId);
          if (intent === "delete" && !exists) return;
          if (intent === "edit" && !exists) {
            toast.show({ message: calendarCopy.deletedElsewhere, tone: "info" });
            return;
          }
          toast.show({ message: GENERIC_WRITE_ERROR, tone: "error" });
        }, REJECTION_SETTLE_MS);
      });
    },
    [toast],
  );

  const actions = useMemo<CalendarActions>(
    () => ({
      create(input) {
        const { id, committed } = createEvent(householdId, input, uid);
        report(committed, id, "create");
        return id;
      },
      update(event, changes) {
        if (Object.keys(changes).length === 0) return;
        report(updateEvent(householdId, event.id, changes), event.id, "edit");
      },
      remove(event) {
        deleted.current.add(event.id);
        report(deleteEvent(householdId, event.id), event.id, "delete");
      },
    }),
    [householdId, uid, report],
  );
  return { actions, deletedHere };
}

/**
 * The Termin-Sheet (phones) / a 560 px dialog (desktop, D46): «Neuer Termin» (D47) or «Termin
 * bearbeiten». Validates on save (title) and while editing (times, D48); saves only changed
 * fields and closes at once; closes with a toast when the event is deleted elsewhere (D52).
 */
function EventSheet({
  state,
  onClose,
  onDelete,
}: {
  state: SheetState | null;
  onClose: () => void;
  onDelete: (event: CalendarEvent) => void;
}) {
  const { household, members, events } = useLoadedHousehold();
  const { actions } = useCalendar();
  const toast = useToast();
  const desktop = useIsDesktop();
  const formId = useId();
  const timeZone = household.timeZone;

  const editId = state?.mode === "edit" ? state.eventId : undefined;
  const event = editId ? events.find((candidate) => candidate.id === editId) : undefined;
  const options = state?.mode === "new" ? state.options : {};
  // The event as it was when the sheet opened: the base for «only changed fields».
  const [original] = useState(event);
  const [values, setValues] = useState<EventFormValues>(() =>
    initialEventFormValues(event, options.prefill ?? {}, { now: new Date(), timeZone }),
  );
  const [submitted, setSubmitted] = useState(false);

  const vanished = editId !== undefined && !event;
  useEffect(() => {
    if (!vanished) return;
    toast.show({ message: calendarCopy.deletedElsewhere, tone: "info" });
    onClose();
  }, [vanished, toast, onClose]);

  const problems = validateEventForm(values, timeZone);
  // The title error shows after a save attempt; the times error at once (D48).
  const errors = {
    title: submitted ? problems.title : undefined,
    description: problems.description,
    times: problems.times,
  };
  const editing = state?.mode === "edit" || (state === null && original !== undefined);
  const changes = original ? eventChanges(original, values, timeZone, members) : {};
  const canSave =
    !problems.times &&
    !problems.description &&
    values.title.trim() !== "" &&
    (!editing || Object.keys(changes).length > 0);

  function submit() {
    setSubmitted(true);
    if (problems.title || problems.times || problems.description) return;
    if (editing) {
      if (event && original) actions.update(event, changes);
    } else {
      actions.create(eventInput(values, timeZone, members));
    }
    onClose();
  }

  const primaryLabel = editing ? actionLabels.save : calendarCopy.addEvent;

  return (
    <Sheet
      open={state !== null && !vanished}
      onClose={onClose}
      title={editing ? calendarCopy.editEvent : calendarCopy.newEvent}
      size="md"
      footer={
        desktop ? (
          <>
            {editing && event && (
              <Button
                variant="danger-ghost"
                size="compact"
                icon={TrashIcon}
                onClick={() => onDelete(event)}
                className="mr-auto"
              >
                {calendarCopy.deleteEvent}
              </Button>
            )}
            <Button variant="secondary" size="compact" onClick={onClose}>
              {actionLabels.cancel}
            </Button>
            <Button type="submit" form={formId} size="compact" disabled={!canSave}>
              {primaryLabel}
            </Button>
          </>
        ) : (
          <Button type="submit" form={formId} size="lg" disabled={!canSave} className="w-full">
            {primaryLabel}
          </Button>
        )
      }
    >
      <EventForm
        formId={formId}
        values={values}
        onChange={setValues}
        errors={errors}
        members={members}
        timeZone={timeZone}
        focus={options.focus ?? "title"}
        onSubmit={submit}
        onDelete={!desktop && editing && event ? () => onDelete(event) : undefined}
      />
    </Sheet>
  );
}
