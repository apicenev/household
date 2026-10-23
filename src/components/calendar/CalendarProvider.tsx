import { TrashIcon } from "@heroicons/react/20/solid";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useIsDesktop } from "../../hooks/useMediaQuery";
import { useAuth } from "../../lib/auth/useAuth";
import { actions as actionLabels, calendarCopy } from "../../lib/copy";
import { GENERIC_WRITE_ERROR } from "../../lib/firestoreErrors";
import { useLoadedHousehold } from "../../lib/household/useHousehold";
import { clearsExceptions, eventStartKey, occurrenceOn, overrideFor } from "../../domain/calendar";
import { formatDate, fromDateKey } from "../../lib/format";
import {
  cancelOccurrence,
  createEvent,
  deleteEvent,
  editOccurrence,
  updateEvent,
} from "../../services/eventService";
import type { CalendarEvent, EventOccurrence } from "../../types";
import { SeriesDeleteChoice, type SeriesChoice } from "../tasks/SeriesDeleteChoice";
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
  | { mode: "edit"; eventId: string; onDeleted?: () => void }
  // Phase 9 D93: one occurrence of a series, by its schedule date.
  | { mode: "occurrence"; eventId: string; dateKey: string; onDeleted?: () => void };

interface PendingChoice {
  /** The occurrence as shown (moved or changed ones with their own date and title). */
  occurrence: EventOccurrence;
  onDeleted?: () => void;
}

/** «Sa., 10. Okt.» of a date key. */
const dayLabel = (dateKey: string) => formatDate(fromDateKey(dateKey), "UTC");

/**
 * Calendar writes plus the one shared Termin-Sheet and delete confirmation (6.8) for the
 * whole shell of a loaded household, so the Kalender page and the Schnellerfassung share them
 * (like TaskProvider and ShoppingProvider). For an occurrence of a series, «Bearbeiten» and
 * «Löschen» first ask «Nur diesen Termin / Ganze Serie» (Phase 9 D92, REV-07).
 */
export function CalendarProvider({ children }: { children: ReactNode }) {
  const { actions, deletedHere } = useCalendarWriter();
  const { household, members, events } = useLoadedHousehold();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  // Bumped on every open, so the form starts from fresh values.
  const [sheetKey, setSheetKey] = useState(0);
  const [deleting, setDeleting] = useState<{
    event: CalendarEvent;
    onDeleted?: () => void;
    occurrence?: EventOccurrence;
  } | null>(null);
  const [deleteChoice, setDeleteChoice] = useState<SeriesChoice>("one");
  const [editing, setEditing] = useState<PendingChoice | null>(null);
  const [editChoice, setEditChoice] = useState<SeriesChoice>("one");

  const openNewEvent = useCallback((options: NewEventOptions = {}) => {
    setSheet({ mode: "new", options });
    setSheetKey((key) => key + 1);
  }, []);
  const openEditEvent = useCallback((eventId: string, onDeleted?: () => void) => {
    setSheet({ mode: "edit", eventId, onDeleted });
    setSheetKey((key) => key + 1);
  }, []);
  const editOccurrenceChoice = useCallback(
    (occurrence: EventOccurrence, onDeleted?: () => void) => {
      if (!occurrence.event.recurrence || !occurrence.seriesDate) {
        openEditEvent(occurrence.event.id, onDeleted);
        return;
      }
      setEditChoice("one");
      setEditing({ occurrence, onDeleted });
    },
    [openEditEvent],
  );
  const closeSheet = useCallback(() => setSheet(null), []);
  const confirmDelete = useCallback(
    (event: CalendarEvent, onDeleted?: () => void, occurrence?: EventOccurrence) => {
      setDeleteChoice("one");
      setDeleting({ event, onDeleted, occurrence });
    },
    [],
  );

  const value = useMemo<CalendarContextValue>(
    () => ({
      actions,
      openNewEvent,
      openEditEvent,
      editOccurrence: editOccurrenceChoice,
      confirmDelete,
      deletedHere,
    }),
    [actions, openNewEvent, openEditEvent, editOccurrenceChoice, confirmDelete, deletedHere],
  );

  // The stored series behind a (possibly changed) occurrence.
  const seriesOf = (eventId: string) => events.find((event) => event.id === eventId);
  const deletingOne =
    deleting?.occurrence?.seriesDate && deleting.event.recurrence ? deleting.occurrence : null;
  const names = members.map((member) => member.displayName);
  const editingSeries = editing ? seriesOf(editing.occurrence.event.id) : undefined;

  return (
    <CalendarContext.Provider value={value}>
      {children}
      <EventSheet
        key={sheetKey}
        state={sheet}
        onClose={closeSheet}
        onDelete={(event, occurrence) =>
          confirmDelete(event, sheet?.mode !== "new" ? sheet?.onDeleted : undefined, occurrence)
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
          if (deletingOne?.seriesDate && deleteChoice === "one") {
            actions.cancelOccurrence(deleting.event, deletingOne.seriesDate);
          } else {
            actions.remove(deleting.event);
          }
          setDeleting(null);
        }}
        title={
          deleting ? calendarCopy.deleteTitle(deletingOne?.event.title ?? deleting.event.title) : ""
        }
        text={
          deletingOne
            ? calendarCopy.single.deleteLegend
            : (deleting?.event.recurrence
                ? calendarCopy.deleteSeriesText
                : calendarCopy.deleteText)(names)
        }
        confirmLabel={
          deletingOne
            ? deleteChoice === "one"
              ? calendarCopy.single.oneCta
              : calendarCopy.single.allCta
            : actionLabels.delete
        }
      >
        {deletingOne && (
          <SeriesDeleteChoice
            value={deleteChoice}
            onChange={setDeleteChoice}
            labels={{ one: calendarCopy.single.one, all: calendarCopy.single.all }}
            legend={calendarCopy.single.deleteLegend}
            oneHint={calendarCopy.single.oneHint(dayLabel(deletingOne.date))}
            allHint={calendarCopy.deleteSeriesText(names)}
          />
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={editing !== null && editingSeries !== undefined}
        onClose={() => setEditing(null)}
        onConfirm={() => {
          if (!editing?.occurrence.seriesDate) return;
          const { occurrence, onDeleted } = editing;
          setEditing(null);
          if (editChoice === "all") {
            openEditEvent(occurrence.event.id, onDeleted);
            return;
          }
          setSheet({
            mode: "occurrence",
            eventId: occurrence.event.id,
            dateKey: occurrence.seriesDate ?? occurrence.date,
            onDeleted,
          });
          setSheetKey((key) => key + 1);
        }}
        title={calendarCopy.single.editTitle}
        confirmLabel={calendarCopy.single.continue}
        icon={PencilSquareIcon}
        tone="brand"
      >
        {editing && editingSeries && (
          <SeriesDeleteChoice
            value={editChoice}
            onChange={setEditChoice}
            labels={{ one: calendarCopy.single.one, all: calendarCopy.single.all }}
            legend={calendarCopy.single.editLegend}
            oneHint={calendarCopy.single.oneHint(dayLabel(editing.occurrence.date))}
            allHint={calendarCopy.single.allEditHint(
              dayLabel(eventStartKey(editingSeries, household.timeZone)),
            )}
            tone="brand"
          />
        )}
      </ConfirmDialog>
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
        // Phase 9 B12: a new rule, start or times reset the single-occurrence changes.
        const write =
          event.exceptions !== undefined && clearsExceptions(changes)
            ? updateEvent(householdId, event.id, changes, { clearExceptions: true })
            : updateEvent(householdId, event.id, changes);
        report(write, event.id, "edit");
      },
      remove(event) {
        deleted.current.add(event.id);
        report(deleteEvent(householdId, event.id), event.id, "delete");
      },
      cancelOccurrence(event, dateKey) {
        report(cancelOccurrence(householdId, event.id, dateKey), event.id, "edit");
      },
      editOccurrence(event, dateKey, override) {
        report(editOccurrence(householdId, event.id, dateKey, override), event.id, "edit");
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
  onDelete: (event: CalendarEvent, occurrence?: EventOccurrence) => void;
}) {
  const { household, members, events } = useLoadedHousehold();
  const { actions } = useCalendar();
  const toast = useToast();
  const desktop = useIsDesktop();
  const formId = useId();
  const timeZone = household.timeZone;

  const editId = state && state.mode !== "new" ? state.eventId : undefined;
  const event = editId ? events.find((candidate) => candidate.id === editId) : undefined;
  // Phase 9 D93: one occurrence of a series (null once it's cancelled elsewhere).
  const dateKey = state?.mode === "occurrence" ? state.dateKey : undefined;
  const occurrence = event && dateKey ? occurrenceOn(event, dateKey, timeZone) : undefined;
  const options = state?.mode === "new" ? state.options : {};
  // What the sheet edits, as it was when it opened: the base for «only changed fields». For one
  // occurrence, the occurrence as a one-off event (its times, its own fields, no rule).
  const [original] = useState(
    occurrence
      ? {
          ...occurrence.event,
          start: occurrence.start,
          end: occurrence.end,
          recurrence: undefined,
          exceptions: undefined,
        }
      : event,
  );
  const [values, setValues] = useState<EventFormValues>(() =>
    initialEventFormValues(original, options.prefill ?? {}, { now: new Date(), timeZone }),
  );
  const [submitted, setSubmitted] = useState(false);

  // Deleted elsewhere, or (one occurrence) cancelled elsewhere.
  const vanished = editId !== undefined && (!event || (dateKey !== undefined && !occurrence));
  useEffect(() => {
    if (!vanished) return;
    toast.show({ message: calendarCopy.deletedElsewhere, tone: "info" });
    onClose();
  }, [vanished, toast, onClose]);

  const { weekStartsOn } = household;
  const problems = validateEventForm(values, timeZone, weekStartsOn);
  // The title error shows after a save attempt; the times and «Endet am» errors at once (D48,
  // D66).
  const errors = {
    title: submitted ? problems.title : undefined,
    description: problems.description,
    times: problems.times,
    until: problems.until,
  };
  const editing =
    (state !== null && state.mode !== "new") || (state === null && original !== undefined);
  const changes = original ? eventChanges(original, values, timeZone, members, weekStartsOn) : {};
  const canSave =
    !problems.times &&
    !problems.description &&
    !problems.until &&
    values.title.trim() !== "" &&
    (!editing || Object.keys(changes).length > 0);

  function submit() {
    setSubmitted(true);
    if (problems.title || problems.times || problems.description || problems.until) return;
    if (editing && dateKey !== undefined) {
      if (event) {
        const input = eventInput(values, timeZone, members, weekStartsOn);
        actions.editOccurrence(event, dateKey, overrideFor(event, input));
      }
    } else if (editing) {
      if (event && original) actions.update(event, changes);
    } else {
      actions.create(eventInput(values, timeZone, members, weekStartsOn));
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
                onClick={() => onDelete(event, occurrence ?? undefined)}
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
        weekStartsOn={weekStartsOn}
        seriesSince={
          original?.recurrence
            ? formatDate(fromDateKey(eventStartKey(original, timeZone)), "UTC")
            : undefined
        }
        singleDate={occurrence ? dayLabel(occurrence.date) : undefined}
        resetNote={original?.exceptions !== undefined && clearsExceptions(changes)}
        focus={options.focus ?? "title"}
        onSubmit={submit}
        onDelete={
          !desktop && editing && event ? () => onDelete(event, occurrence ?? undefined) : undefined
        }
      />
    </Sheet>
  );
}
