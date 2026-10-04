import { useRef, type ChangeEvent } from "react";
import { cx } from "../../lib/cx";
import { formatDate, fromDateKey } from "../../lib/format";

interface PillProps {
  /** Accessible name, e.g. «Beginn, Datum». */
  label: string;
  /** Marks the pill as invalid (e.g. the end before the start, Phase 6 D48). */
  invalid?: boolean;
  /** Id of the error text that describes it. */
  describedBy?: string;
  disabled?: boolean;
  className?: string;
  "data-autofocus"?: boolean;
}

/**
 * The compact date / time pickers of the Termin-Sheet rows «Beginn» / «Ende»
 * (`Sheets.dc.html`, Phase 6 D48): a 40 px sunken pill with the value in 15 px semibold and the
 * native input invisible on top, so the platform picker opens on tap and typing works. The
 * input keeps 16 px text, so iOS Safari doesn't zoom.
 */
function Pill({
  display,
  type,
  value,
  onChange,
  label,
  invalid,
  describedBy,
  disabled,
  className,
  ...rest
}: PillProps & {
  display: string;
  type: "date" | "time";
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <span
      className={cx(
        "relative inline-flex h-10 shrink-0 items-center rounded-[10px] px-3 text-[15px] font-semibold tabular-nums transition-[box-shadow] duration-(--duration-fast)",
        disabled ? "bg-sunken text-ink-subtle" : "bg-sunken text-ink",
        invalid
          ? "text-danger inset-ring-[1.5px] inset-ring-danger focus-within:ring-3 focus-within:ring-danger-soft"
          : "focus-within:ring-3 focus-within:inset-ring-[1.5px] focus-within:ring-brand-soft focus-within:inset-ring-brand",
        className,
      )}
    >
      <span aria-hidden="true">{display}</span>
      <input
        ref={inputRef}
        type={type}
        value={value}
        disabled={disabled}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          // The native inputs allow clearing; a start or end is always required.
          if (event.target.value) onChange(event.target.value);
        }}
        onClick={() => {
          try {
            inputRef.current?.showPicker();
          } catch {
            // Not supported or already open: typing still works.
          }
        }}
        className="absolute inset-0 size-full cursor-pointer text-[16px] opacity-0 disabled:cursor-not-allowed [&::-webkit-calendar-picker-indicator]:hidden"
        {...rest}
      />
    </span>
  );
}

/** «Sa., 3. Okt.» for a date key («2026-10-03»). */
export function DatePill(props: PillProps & { value: string; onChange: (value: string) => void }) {
  return <Pill {...props} type="date" display={formatDate(fromDateKey(props.value), "UTC")} />;
}

/** «10:00» (24-hour). */
export function TimePill(props: PillProps & { value: string; onChange: (value: string) => void }) {
  return <Pill {...props} type="time" display={props.value} />;
}
