import { UserGroupIcon } from "@heroicons/react/16/solid";
import { TrashIcon } from "@heroicons/react/20/solid";
import { SunIcon } from "@heroicons/react/24/outline";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { EVENT_DESCRIPTION_MAX, EVENT_TITLE_MAX } from "../../domain/eventTime";
import { calendarCopy } from "../../lib/copy";
import { cx } from "../../lib/cx";
import type { EventCategory, Member } from "../../types";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { eventCategories } from "../ui/categories";
import { DatePill, TimePill } from "../ui/DateTimePill";
import { TextField } from "../ui/TextField";
import { Textarea } from "../ui/Textarea";
import { Toggle } from "../ui/Toggle";
import {
  toggleParticipant,
  withAllDay,
  withEnd,
  withStart,
  type EventFormError,
  type EventFormValues,
} from "./eventFormValues";

/** Where the sheet puts the focus first (D56: a Schnellerfassung chip names its field). */
export type EventFormFocus = "title" | "date" | "time" | "participants" | "category";

const CATEGORY_ORDER = Object.keys(eventCategories) as EventCategory[];

const errorText: Record<EventFormError, string> = {
  titleEmpty: calendarCopy.titleEmpty,
  titleTooLong: calendarCopy.titleTooLong,
  descriptionTooLong: calendarCopy.descriptionTooLong,
  endBeforeStart: calendarCopy.endBeforeStart,
  tooLong: calendarCopy.tooLong,
  notMidnight: calendarCopy.endBeforeStart,
};

interface EventFormProps {
  formId: string;
  values: EventFormValues;
  onChange: (values: EventFormValues) => void;
  /** Errors shown so far (title after a submit, times as soon as they're wrong). */
  errors: { title?: EventFormError; description?: EventFormError; times?: EventFormError };
  members: readonly Member[];
  timeZone: string;
  focus: EventFormFocus;
  onSubmit: () => void;
  /** Phones, edit only: «Termin löschen» at the end of the form (desktop: in the footer). */
  onDelete?: () => void;
}

/**
 * The fields of «Neuer Termin» / «Termin bearbeiten» (`Sheets.dc.html` → Termin-Sheet, D46,
 * D48, D58): Titel; «Ganztägig» with the «Beginn» / «Ende» rows; «Für»; «Kategorie»;
 * «Beschreibung». «Wiederholen» arrives in Phase 7. The submit buttons live in the sheet
 * footer (`form` attribute).
 */
export function EventForm({
  formId,
  values,
  onChange,
  errors,
  members,
  timeZone,
  focus,
  onSubmit,
  onDelete,
}: EventFormProps) {
  const timesErrorId = useId();
  const participantsLabelId = useId();
  const categoryLabelId = useId();
  const timesError = errors.times ? errorText[errors.times] : undefined;
  const autofocus = (target: EventFormFocus) => (focus === target ? true : undefined);

  const row = (label: string, date: ReactNode, time: ReactNode, last: boolean) => (
    <div
      className={cx(
        "flex min-h-14 items-center gap-2 pr-2 pl-3.5",
        !last && "border-b border-line",
      )}
    >
      <span className="w-14 text-[15px] text-ink-muted">{label}</span>
      <span className="flex-1" />
      {date}
      {!values.allDay && time}
    </div>
  );

  return (
    <form
      id={formId}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-4.5"
    >
      <TextField
        label={calendarCopy.title}
        value={values.title}
        onChange={(event) => onChange({ ...values, title: event.target.value })}
        maxLength={EVENT_TITLE_MAX}
        error={errors.title ? errorText[errors.title] : undefined}
        autoComplete="off"
        enterKeyHint="done"
        onKeyDown={(event) => {
          // No implicit submission while «Speichern» is disabled (empty title), but Enter
          // should still show «Gib einen Titel ein.» (as the task sheet).
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          }
        }}
        data-autofocus={autofocus("title")}
      />

      <div className="flex flex-col gap-1.5">
        <div className="overflow-hidden rounded-control inset-ring inset-ring-line-strong">
          <Toggle
            checked={values.allDay}
            onChange={(allDay) => onChange(withAllDay(values, allDay))}
            label={
              <span className="flex items-center gap-3">
                <SunIcon aria-hidden="true" className="size-6 text-ink-muted" />
                {calendarCopy.allDay}
              </span>
            }
            className="pr-3 pl-3.5"
          />
          {row(
            calendarCopy.start,
            <DatePill
              label={calendarCopy.pickerLabel(calendarCopy.start, calendarCopy.date)}
              value={values.startKey}
              onChange={(key) => onChange(withStart(values, { key }, timeZone))}
              data-autofocus={autofocus("date")}
            />,
            <TimePill
              label={calendarCopy.pickerLabel(calendarCopy.start, calendarCopy.time)}
              value={values.startTime}
              onChange={(time) => onChange(withStart(values, { time }, timeZone))}
              data-autofocus={autofocus("time")}
            />,
            false,
          )}
          {row(
            calendarCopy.end,
            <DatePill
              label={calendarCopy.pickerLabel(calendarCopy.end, calendarCopy.date)}
              value={values.endKey}
              onChange={(key) => onChange(withEnd(values, { key }))}
              invalid={Boolean(timesError)}
              describedBy={timesError ? timesErrorId : undefined}
            />,
            <TimePill
              label={calendarCopy.pickerLabel(calendarCopy.end, calendarCopy.time)}
              value={values.endTime}
              onChange={(time) => onChange(withEnd(values, { time }))}
              invalid={Boolean(timesError)}
              describedBy={timesError ? timesErrorId : undefined}
            />,
            true,
          )}
        </div>
        {timesError && (
          <span id={timesErrorId} className="px-1 text-[13px] font-medium text-danger">
            {timesError}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span id={participantsLabelId} className="text-body-sm font-semibold text-ink">
          {calendarCopy.participants}
        </span>
        <div role="group" aria-labelledby={participantsLabelId} className="flex flex-wrap gap-2">
          <ParticipantChip
            selected={values.participants === "household"}
            onClick={() => onChange({ ...values, participants: "household" })}
            leading={
              <span className="flex size-8 items-center justify-center rounded-pill bg-sunken text-ink-muted">
                <UserGroupIcon aria-hidden="true" className="size-4" />
              </span>
            }
            autofocus={autofocus("participants")}
          >
            {calendarCopy.everyone}
          </ParticipantChip>
          {members.length > 1 &&
            members.map((member) => (
              <ParticipantChip
                key={member.uid}
                selected={
                  values.participants !== "household" && values.participants.includes(member.uid)
                }
                onClick={() =>
                  onChange({
                    ...values,
                    participants: toggleParticipant(values.participants, member.uid, members),
                  })
                }
                leading={<Avatar initials={member.initials} color={member.avatarColor} size={32} />}
              >
                {member.displayName.split(/\s+/)[0]}
              </ParticipantChip>
            ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span id={categoryLabelId} className="text-body-sm font-semibold text-ink">
          {calendarCopy.category}
        </span>
        <CategoryPicker
          labelledBy={categoryLabelId}
          value={values.category}
          onChange={(category) => onChange({ ...values, category })}
          autofocus={autofocus("category")}
        />
      </div>

      <Textarea
        label={calendarCopy.description}
        value={values.description}
        onChange={(event) => onChange({ ...values, description: event.target.value })}
        maxLength={EVENT_DESCRIPTION_MAX}
        showCount={false}
        rows={2}
        error={errors.description ? errorText[errors.description] : undefined}
      />

      {onDelete && (
        <Button variant="danger-ghost" size="md" icon={TrashIcon} onClick={onDelete}>
          {calendarCopy.deleteEvent}
        </Button>
      )}
    </form>
  );
}

/** A «Für» chip (D58): 44 px pill with a 32 px avatar, pressed when picked. */
function ParticipantChip({
  selected,
  onClick,
  leading,
  autofocus,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  leading: ReactNode;
  autofocus?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      data-autofocus={autofocus}
      className={cx(
        "flex h-11 cursor-pointer items-center gap-2 rounded-pill pr-3.5 pl-1.5 text-[15px] font-semibold transition-colors duration-(--duration-fast)",
        selected
          ? "bg-brand-soft text-brand-strong inset-ring-[1.5px] inset-ring-brand"
          : "bg-surface text-ink inset-ring inset-ring-line-strong hovered:bg-sunken",
      )}
    >
      {leading}
      {children}
    </button>
  );
}

/**
 * «Kategorie» (CAL-07): radio chips with the category icon in its colour; selected in the
 * category's soft colour with its ring. One tab stop, arrow keys move and select.
 */
function CategoryPicker({
  labelledBy,
  value,
  onChange,
  autofocus,
}: {
  labelledBy: string;
  value: EventCategory;
  onChange: (category: EventCategory) => void;
  autofocus?: boolean;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = CATEGORY_ORDER.length - 1;
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? index === 0
            ? last
            : index - 1
          : null;
    if (next === null) return;
    event.preventDefault();
    onChange(CATEGORY_ORDER[next]);
    refs.current[next]?.focus();
  }
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-1.5">
      {CATEGORY_ORDER.map((category, index) => {
        const style = eventCategories[category];
        const Icon = style.icon;
        const selected = category === value;
        return (
          <button
            key={category}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(category)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            data-autofocus={selected ? autofocus : undefined}
            className={cx(
              "flex h-10 cursor-pointer items-center gap-1.5 rounded-pill pr-3 pl-2.5 text-body-sm font-semibold transition-colors duration-(--duration-fast)",
              selected
                ? cx(style.pill, categoryRing[category])
                : "bg-surface text-ink inset-ring inset-ring-line-strong hovered:bg-sunken",
            )}
          >
            <Icon aria-hidden="true" className={cx("size-4", style.main)} />
            {style.label}
          </button>
        );
      })}
    </div>
  );
}

/** The selected chip's 1.5 px ring in the category colour (`Sheets.dc.html`). */
const categoryRing: Record<EventCategory, string> = {
  social: "inset-ring-[1.5px] inset-ring-event-social",
  appointment: "inset-ring-[1.5px] inset-ring-event-appointment",
  travel: "inset-ring-[1.5px] inset-ring-event-travel",
  home: "inset-ring-[1.5px] inset-ring-event-home",
  reminder: "inset-ring-[1.5px] inset-ring-event-reminder",
  other: "inset-ring-[1.5px] inset-ring-event-other",
};
