import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { MinusIcon, PlusIcon } from "@heroicons/react/20/solid";
import { useId } from "react";
import { weekdayOfKey } from "../../domain/dateKeys";
import {
  MAX_INTERVAL,
  MIN_PICKER_N,
  PICKER_FREQS,
  ruleFromPicker,
  type PickerFreq,
  type PickerState,
} from "../../domain/recurrence";
import { recurrenceCopy } from "../../lib/copy";
import { cx } from "../../lib/cx";
import {
  describeRule,
  WEEKDAY_NAMES,
  WEEKDAY_SHORT,
  weekdaysInOrder,
} from "../../lib/recurrenceFormat";
import type { WeekStart } from "../../types";

export interface RecurrencePickerProps {
  value: PickerState;
  /** Called with the new state; `freq` changes go through `onFreqChange` too. */
  onChange: (value: PickerState) => void;
  /** The due date the rule is anchored at (monthly / yearly day, default weekday). */
  dueDate: string;
  weekStartsOn: WeekStart;
  /** Focus the first chip on open (Schnellerfassung «Wiederholen», D31). */
  autoFocus?: boolean;
}

const weekly = (freq: PickerFreq) => freq === "weekly" || freq === "nweeks";

/**
 * «Wiederholen» (`RecurrencePicker.dc.html`): summary, frequency chips, «Alle [−] N [+]
 * Wochen / Tage» (2–52) and «An diesen Tagen» in the household's week order (D32). Tasks
 * don't offer «Benutzerdefiniert», «Am 1. Samstag» or «Endet» (Phase 4 B2). The last
 * selected weekday can't be deselected (D33).
 */
export function RecurrencePicker({
  value,
  onChange,
  dueDate,
  weekStartsOn,
  autoFocus = false,
}: RecurrencePickerProps) {
  const labelId = useId();
  const daysLabelId = useId();
  const rule = ruleFromPicker(value, dueDate);
  const summary = rule ? describeRule(rule, { weekStartsOn }) : recurrenceCopy.noRepeat;
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
        <div className="flex items-center gap-3 text-[15px] text-ink">
          <span>{recurrenceCopy.every}</span>
          <div className="flex items-center rounded-control bg-surface inset-ring inset-ring-control">
            <StepButton
              label={recurrenceCopy.less}
              onClick={() => setN(value.n - 1)}
              disabled={value.n <= MIN_PICKER_N}
              icon="minus"
            />
            <output
              aria-live="polite"
              className="min-w-7 text-center text-[17px] font-semibold tabular-nums"
            >
              {value.n}
            </output>
            <StepButton
              label={recurrenceCopy.more}
              onClick={() => setN(value.n + 1)}
              disabled={value.n >= MAX_INTERVAL}
              icon="plus"
            />
          </div>
          <span>{value.freq === "ndays" ? recurrenceCopy.days : recurrenceCopy.weeks}</span>
        </div>
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
