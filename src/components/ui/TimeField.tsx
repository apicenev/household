import { ClockIcon } from "@heroicons/react/24/outline";
import { useId, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Field } from "./Field";
import { controlClasses, describedBy } from "./fieldStyles";

export interface TimeFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "size"
> {
  label: ReactNode;
  optional?: boolean;
  helper?: ReactNode;
  error?: ReactNode;
  /** Shows the clock icon (default true); the end field of a range has none. */
  showIcon?: boolean;
  className?: string;
}

/** Native 24-hour time input («10:00») styled as a field. */
export function TimeField({
  label,
  optional,
  helper,
  error,
  showIcon = true,
  disabled,
  className,
  id,
  onClick,
  ...rest
}: TimeFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const ids = { helperId: `${inputId}-helper`, errorId: `${inputId}-error` };
  const inputRef = useRef<HTMLInputElement>(null);

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
      <div className="relative">
        {showIcon && (
          <ClockIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-6 -translate-y-1/2 text-ink-muted"
          />
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="time"
          disabled={disabled}
          onClick={(event) => {
            try {
              inputRef.current?.showPicker();
            } catch {
              // Picker not supported: typing still works.
            }
            onClick?.(event);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(ids, helper, error)}
          className={cx(
            controlClasses({ error: Boolean(error), disabled }),
            "h-12 cursor-pointer pr-3 tabular-nums [&::-webkit-calendar-picker-indicator]:hidden",
            showIcon ? "pl-11" : "pl-3",
          )}
          {...rest}
        />
      </div>
    </Field>
  );
}
