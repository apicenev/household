import { XCircleIcon } from "@heroicons/react/20/solid";
import { CalendarIcon } from "@heroicons/react/24/outline";
import { useId, useRef, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import { DEFAULT_TIME_ZONE, formatDate, fromDateKey, quickPickDates } from "../../lib/format";
import { Field } from "./Field";
import { describedBy } from "./fieldStyles";

export interface DateFieldProps {
  label: ReactNode;
  /** «2026-10-03», or "" for no date. */
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  helper?: ReactNode;
  error?: ReactNode;
  disabled?: boolean;
  /** Shown when no date is set. */
  placeholder?: string;
  /** Shows the clear button when a date is set (default true). */
  clearable?: boolean;
  /** Shows «Heute» / «Morgen» / next Saturday chips below the field. */
  quickPicks?: boolean;
  /** Adds an «Ohne Datum» chip after the quick picks (clears the date; task sheet). */
  noDatePick?: boolean;
  /** Injectable for tests. */
  today?: Date;
  timeZone?: string;
  className?: string;
  id?: string;
}

/**
 * Native date picker styled as a field: the value is shown as «Sa., 3. Okt.», while the
 * invisible native input on top opens the platform picker (and takes keyboard input).
 */
export function DateField({
  label,
  value,
  onChange,
  optional,
  helper,
  error,
  disabled,
  placeholder = "Ohne Datum",
  clearable = true,
  quickPicks = false,
  noDatePick = false,
  today = new Date(),
  timeZone = DEFAULT_TIME_ZONE,
  className,
  id,
}: DateFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const ids = { helperId: `${inputId}-helper`, errorId: `${inputId}-error` };
  const inputRef = useRef<HTMLInputElement>(null);

  const picks: Array<{ label: string; key: string; ariaLabel?: string }> = [
    ...(quickPicks ? quickPickDates(today, timeZone) : []),
    ...(noDatePick ? [{ label: placeholder, key: "" }] : []),
  ];

  function openPicker() {
    try {
      inputRef.current?.showPicker();
    } catch {
      // Not supported or not allowed (e.g. already open): the native input still works.
    }
  }

  return (
    <Field
      label={label}
      optional={optional}
      helper={helper}
      error={error}
      disabled={disabled}
      htmlFor={inputId}
      className={className}
      {...ids}
    >
      <div
        className={cx(
          "relative flex h-12 items-center gap-2.5 rounded-control pr-1 pl-3 text-body transition-[border-color,box-shadow] duration-(--duration-fast)",
          disabled
            ? "border border-line bg-sunken text-ink-subtle"
            : error
              ? "border-[1.5px] border-danger bg-surface text-ink focus-within:ring-3 focus-within:ring-danger-soft"
              : "border border-control bg-surface text-ink focus-within:border-brand focus-within:ring-3 focus-within:ring-brand-soft hover:border-ink-muted",
        )}
      >
        <CalendarIcon aria-hidden="true" className="size-6 shrink-0 text-ink-muted" />
        <span className={cx("flex-1 tabular-nums", !value && "text-ink-subtle")}>
          {value ? formatDate(fromDateKey(value), timeZone) : placeholder}
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="date"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onClick={openPicker}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(ids, helper, error)}
          className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        {clearable && value && !disabled && (
          <button
            type="button"
            aria-label="Datum entfernen"
            onClick={() => onChange("")}
            className="relative flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-pill text-ink-subtle hovered:text-ink-muted"
          >
            <XCircleIcon aria-hidden="true" className="size-5" />
          </button>
        )}
      </div>
      {picks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {picks.map((pick) => {
            const selected = pick.key === value;
            return (
              <button
                key={pick.label}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                aria-label={pick.ariaLabel}
                onClick={() => onChange(pick.key)}
                className={cx(
                  "flex h-8 cursor-pointer items-center rounded-pill px-3 text-[13px] font-semibold transition-colors duration-(--duration-fast) disabled:cursor-not-allowed disabled:text-ink-subtle",
                  selected
                    ? "bg-brand-soft text-brand-strong"
                    : "text-ink inset-ring inset-ring-line-strong hovered:bg-sunken",
                )}
              >
                {pick.label}
              </button>
            );
          })}
        </div>
      )}
    </Field>
  );
}
