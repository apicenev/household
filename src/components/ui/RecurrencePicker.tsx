import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { MinusIcon, PlusIcon } from "@heroicons/react/20/solid";
import { useId, type ReactNode } from "react";
import { keyParts, weekdayOfKey } from "../../domain/dateKeys";
import {
  eventRuleFromPicker,
  MAX_COUNT,
  MAX_INTERVAL,
  MIN_COUNT,
  MIN_PICKER_N,
  PICKER_FREQS,
  ruleFromPicker,
  setPosOf,
  type EventPickerState,
  type MonthlyMode,
  type PickerEnd,
  type PickerFreq,
  type PickerState,
} from "../../domain/recurrence";
import { calendarCopy, recurrenceCopy } from "../../lib/copy";
import { cx } from "../../lib/cx";
import {
  describeRule,
  describeRuleEnd,
  setPosLabel,
  WEEKDAY_NAMES,
  WEEKDAY_SHORT,
  weekdaysInOrder,
} from "../../lib/recurrenceFormat";
import type { WeekStart } from "../../types";
import { DateField } from "./DateField";
import { SegmentedControl } from "./SegmentedControl";

interface BaseProps {
  /** The date the rule is anchored at: a task's due date, an event's start (day, weekday). */
  dueDate: string;
  weekStartsOn: WeekStart;
  /** Focus the first chip on open (Schnellerfassung «Wiederholen», D31). */
  autoFocus?: boolean;
}

/** Tasks (Phase 4 B2): the chips only. */
interface TaskPickerProps extends BaseProps {
  mode?: "task";
  value: PickerState;
  onChange: (value: PickerState) => void;
}

/** Events (Phase 7 B2): plus the monthly segment (D60) and «Endet» (REV-02, D59). */
interface EventPickerProps extends BaseProps {
  mode: "event";
  value: EventPickerState;
  onChange: (value: EventPickerState) => void;
  /** D66 under the «Endet am» field. */
  untilError?: string;
}

export type RecurrencePickerProps = TaskPickerProps | EventPickerProps;

const weekly = (freq: PickerFreq) => freq === "weekly" || freq === "nweeks";

/**
 * «Wiederholen» (`RecurrencePicker.dc.html`): summary, frequency chips, «Alle [−] N [+]
 * Wochen / Tage» (2–52) and «An diesen Tagen» in the household's week order (D32). The last
 * selected weekday can't be deselected (D33). Tasks don't offer «Benutzerdefiniert», «Am 1.
 * Samstag» or «Endet» (Phase 4 B2); events (`mode="event"`, Phase 7) add the monthly segment
 * «Am 3.» / «Am 1. Samstag» and «Endet» «Nie» / «Am Datum» / «Nach N Mal»
 * («Benutzerdefiniert» stays hidden, B2).
 */
export function RecurrencePicker(props: RecurrencePickerProps) {
  const { value, dueDate, weekStartsOn, autoFocus = false } = props;
  // Every change keeps the event-only fields of an event state.
  const onChange = (next: PickerState) =>
    props.mode === "event" ? props.onChange({ ...props.value, ...next }) : props.onChange(next);
  const labelId = useId();
  const daysLabelId = useId();
  const rule =
    props.mode === "event"
      ? eventRuleFromPicker(props.value, dueDate)
      : ruleFromPicker(value, dueDate);
  const summary = rule
    ? calendarCopy.meta(
        describeRule(rule, { weekStartsOn }),
        props.mode === "event" ? (describeRuleEnd(rule) ?? "") : "",
      )
    : recurrenceCopy.noRepeat;
  const showN = value.freq === "nweeks" || value.freq === "ndays";

  function pick(freq: PickerFreq) {
    // Switching to a weekly rule starts with the due date's weekday (B2).
    const weekdays = weekly(freq) && !weekly(value.freq) ? [weekdayOfKey(dueDate)] : value.weekdays;
    onChange({ ...value, freq, weekdays });
  }

  function toggleDay(day: number) {
    const on = value.weekdays.includes(day);
    if (on && value.weekdays.length === 1) return; // D33
    const weekdays = on
      ? value.weekdays.filter((d) => d !== day)
      : [...value.weekdays, day].sort((a, b) => a - b);
    onChange({ ...value, weekdays });
  }

  const setN = (n: number) =>
    onChange({ ...value, n: Math.min(MAX_INTERVAL, Math.max(MIN_PICKER_N, n)) });

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-start justify-between gap-3">
        <span id={labelId} className="text-body-sm leading-5 font-semibold text-ink">
          {recurrenceCopy.label}
        </span>
        <span
          aria-live="polite"
          className="flex items-start gap-1 text-right text-[13px] leading-5 font-semibold text-brand-strong"
        >
          <ArrowPathIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {summary}
        </span>
      </div>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
        {PICKER_FREQS.map((freq, index) => {
          const on = value.freq === freq;
          return (
            <button
              key={freq}
              type="button"
              aria-pressed={on}
              onClick={() => pick(freq)}
              data-autofocus={autoFocus && index === 0 ? true : undefined}
              className={cx(
                "h-9 cursor-pointer rounded-pill px-3 text-[14px] font-semibold whitespace-nowrap transition-colors duration-(--duration-fast)",
                on
                  ? "bg-brand-soft text-brand-strong inset-ring inset-ring-brand"
                  : "bg-surface text-ink inset-ring inset-ring-line-strong hovered:bg-sunken",
              )}
            >
              {recurrenceCopy.freqs[freq]}
            </button>
          );
        })}
      </div>
      {showN && (
        <Stepper
          before={recurrenceCopy.every}
          after={value.freq === "ndays" ? recurrenceCopy.days : recurrenceCopy.weeks}
          value={value.n}
          min={MIN_PICKER_N}
          max={MAX_INTERVAL}
          onChange={setN}
        />
      )}
      {weekly(value.freq) && (
        <div className="flex flex-col gap-2">
          <span id={daysLabelId} className="text-[13px] font-semibold text-ink-muted">
            {recurrenceCopy.onDays}
          </span>
          <div role="group" aria-labelledby={daysLabelId} className="grid grid-cols-7 gap-1">
            {weekdaysInOrder(weekStartsOn).map((day) => {
              const on = value.weekdays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  aria-label={WEEKDAY_NAMES[day]}
                  onClick={() => toggleDay(day)}
                  className={cx(
                    "h-11 cursor-pointer rounded-pill text-[14px] font-semibold transition-colors duration-(--duration-fast)",
                    on ? "bg-brand text-on-brand" : "bg-sunken text-ink hovered:bg-line",
                  )}
                >
                  {WEEKDAY_SHORT[day]}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {props.mode === "event" && (
        <EventParts
          value={props.value}
          onChange={props.onChange}
          dueDate={dueDate}
          untilError={props.untilError}
        />
      )}
    </div>
  );
}

/**
 * The event-only parts (Phase 7): the monthly segment «Am 3.» / «Am 1. Samstag» from the
 * start date (D60) and, while the event repeats, «Endet» with «Nie» / «Am Datum» (the D59
 * date field) / «Nach [−] N [+] Mal» (2–99).
 */
function EventParts({
  value,
  onChange,
  dueDate,
  untilError,
}: {
  value: EventPickerState;
  onChange: (value: EventPickerState) => void;
  dueDate: string;
  untilError?: string;
}) {
  const weekdayName = WEEKDAY_NAMES[weekdayOfKey(dueDate)];
  const setCount = (count: number) =>
    onChange({ ...value, count: Math.min(MAX_COUNT, Math.max(MIN_COUNT, count)) });
  return (
    <>
      {value.freq === "monthly" && (
        <SegmentedControl<MonthlyMode>
          aria-label={recurrenceCopy.monthlyLabel}
          value={value.monthlyMode}
          onChange={(monthlyMode) => onChange({ ...value, monthlyMode })}
          options={[
            { value: "day", label: recurrenceCopy.monthlyDay(keyParts(dueDate).day) },
            {
              value: "weekday",
              label: recurrenceCopy.monthlyWeekday(setPosLabel(setPosOf(dueDate)), weekdayName),
            },
          ]}
        />
      )}
      {value.freq !== "none" && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <span aria-hidden="true" className="text-[13px] font-semibold text-ink-muted">
            {recurrenceCopy.ends}
          </span>
          <SegmentedControl<PickerEnd>
            aria-label={recurrenceCopy.ends}
            value={value.end}
            onChange={(end) => onChange({ ...value, end })}
            options={(["never", "date", "after"] as const).map((end) => ({
              value: end,
              label: recurrenceCopy.endOptions[end],
            }))}
          />
          {value.end === "date" && (
            <DateField
              label={<span className="sr-only">{recurrenceCopy.endsOn}</span>}
              value={value.until}
              onChange={(until) => until && onChange({ ...value, until })}
              clearable={false}
              error={untilError}
              timeZone="UTC"
            />
          )}
          {value.end === "after" && (
            <Stepper
              before={recurrenceCopy.after}
              after={recurrenceCopy.times}
              value={value.count}
              min={MIN_COUNT}
              max={MAX_COUNT}
              onChange={setCount}
            />
          )}
        </div>
      )}
    </>
  );
}

/** «Nach [−] 10 [+] Mal»: the N stepper of the design. */
function Stepper({
  before,
  after,
  value,
  min,
  max,
  onChange,
}: {
  before: ReactNode;
  after: ReactNode;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 text-[15px] text-ink">
      <span>{before}</span>
      <div className="flex items-center rounded-control bg-surface inset-ring inset-ring-control">
        <StepButton
          label={recurrenceCopy.less}
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          icon="minus"
        />
        <output
          aria-live="polite"
          className="min-w-7 text-center text-[17px] font-semibold tabular-nums"
        >
          {value}
        </output>
        <StepButton
          label={recurrenceCopy.more}
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
          icon="plus"
        />
      </div>
      <span>{after}</span>
    </div>
  );
}

function StepButton({
  label,
  onClick,
  disabled,
  icon,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  icon: "minus" | "plus";
}) {
  const Icon = icon === "minus" ? MinusIcon : PlusIcon;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-11 cursor-pointer items-center justify-center text-ink disabled:cursor-not-allowed disabled:text-ink-subtle"
    >
      <Icon aria-hidden="true" className="size-5" />
    </button>
  );
}
