import { CalendarIcon, CheckCircleIcon, ClockIcon, UserGroupIcon } from "@heroicons/react/16/solid";
import { CalendarIcon as CalendarOutline } from "@heroicons/react/24/outline";
import { useRef, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { parseDayParam } from "../../domain/calendar";
import { EVENT_TITLE_MAX } from "../../domain/eventTime";
import { calendarCopy } from "../../lib/copy";
import { cx } from "../../lib/cx";
import { formatDate, fromDateKey } from "../../lib/format";
import { useLoadedHousehold } from "../../lib/household/useHousehold";
import { QuickChip } from "../tasks/QuickAddTaskForm";
import { Button } from "../ui/Button";
import { eventCategories } from "../ui/categories";
import type { CalendarContextValue } from "./calendarContext";
import type { EventFormFocus } from "./EventForm";
import {
  DEFAULT_EVENT_CATEGORY,
  eventInput,
  initialEventFormValues,
  type EventPrefill,
} from "./eventFormValues";

/**
 * The day the Schnellerfassung plans for (D56): the calendar's selected day while the route is
 * `/calendar` with a valid `?day=`, otherwise today.
 */
function useQuickAddDay(): string | undefined {
  const location = useLocation();
  if (location.pathname !== "/calendar") return undefined;
  return parseDayParam(new URLSearchParams(location.search).get("day")) ?? undefined;
}

/**
 * Schnellerfassung «Termin» (`Sheets.dc.html`, D56): «Was steht an?», chips with the values the
 * event gets (date, time, «Alle», «Sonstiges»; B6), «Mehr Optionen» and «Termin speichern».
 * A chip opens «Neuer Termin» with the title and focus on that field; chips are never
 * «pressed». The field keeps focus after saving.
 */
export function QuickAddEventForm({
  calendar,
  onMoreOptions,
}: {
  calendar: CalendarContextValue;
  /** Closes the Schnellerfassung before the full sheet opens. */
  onMoreOptions: () => void;
}) {
  const { household, members } = useLoadedHousehold();
  const dayKey = useQuickAddDay();
  const [title, setTitle] = useState("");
  const [added, setAdded] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = title.trim();
  const timeZone = household.timeZone;
  const prefill: EventPrefill = { title, ...(dayKey ? { dayKey } : {}) };
  const values = initialEventFormValues(undefined, prefill, { now: new Date(), timeZone });
  const category = eventCategories[DEFAULT_EVENT_CATEGORY];
  const CategoryIcon = category.icon;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!trimmed) return;
    calendar.actions.create(eventInput(values, timeZone, members));
    setAdded(calendarCopy.addedStatus(trimmed));
    setTitle("");
    inputRef.current?.focus();
  }

  function moreOptions(focus?: EventFormFocus) {
    onMoreOptions();
    calendar.openNewEvent({ prefill, focus });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex h-14 items-center gap-2.5 rounded-[14px] bg-surface px-3.5 ring-2 ring-brand">
        <CalendarOutline aria-hidden="true" className="size-6 shrink-0 text-brand" />
        <input
          ref={inputRef}
          data-autofocus
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setAdded("");
          }}
          maxLength={EVENT_TITLE_MAX}
          placeholder={calendarCopy.quickAddPlaceholder}
          aria-label={calendarCopy.quickAddPlaceholder}
          autoComplete="off"
          enterKeyHint="done"
          className="h-full min-w-0 flex-1 bg-transparent text-[18px] text-ink outline-none placeholder:text-ink-subtle"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <QuickChip
          onClick={() => moreOptions("date")}
          leading={<CalendarIcon aria-hidden="true" className="size-4" />}
        >
          {formatDate(fromDateKey(values.startKey), "UTC")}
        </QuickChip>
        <QuickChip
          onClick={() => moreOptions("time")}
          leading={<ClockIcon aria-hidden="true" className="size-4" />}
        >
          {values.startTime}
        </QuickChip>
        <QuickChip
          onClick={() => moreOptions("participants")}
          leading={<UserGroupIcon aria-hidden="true" className="size-4" />}
        >
          {calendarCopy.everyone}
        </QuickChip>
        <QuickChip
          onClick={() => moreOptions("category")}
          leading={<CategoryIcon aria-hidden="true" className={cx("size-4", category.main)} />}
        >
          {category.label}
        </QuickChip>
      </div>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => moreOptions()}
          className="flex min-h-11 cursor-pointer items-center text-[15px] font-semibold text-brand-strong hovered:text-brand-hover"
        >
          {calendarCopy.moreOptions}
        </button>
        <Button type="submit" size="lg" disabled={!trimmed}>
          {calendarCopy.saveQuick}
        </Button>
      </div>
      <span
        role="status"
        className={cx(
          "flex items-center gap-1.5 text-body-sm font-medium text-success",
          !added && "sr-only",
        )}
      >
        {added && <CheckCircleIcon aria-hidden="true" className="size-4" />}
        {added}
      </span>
    </form>
  );
}
