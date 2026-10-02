import { useId, type ComponentProps, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Field } from "./Field";
import { controlClasses, describedBy } from "./fieldStyles";

export interface TextFieldProps extends Omit<ComponentProps<"input">, "size"> {
  label: ReactNode;
  optional?: boolean;
  helper?: ReactNode;
  error?: ReactNode;
  /** Error styling without a message of its own (e.g. when a form-level alert explains it). */
  invalid?: boolean;
  /** Leading element inside the field, e.g. a lock icon (16/solid). */
  leading?: ReactNode;
  /** Trailing 44 px control inside the field, e.g. the password eye button. */
  trailing?: ReactNode;
  className?: string;
  inputClassName?: string;
}

export function TextField({
  label,
  optional,
  helper,
  error,
  invalid = false,
  leading,
  trailing,
  disabled,
  className,
  inputClassName,
  id,
  ...rest
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const ids = { helperId: `${inputId}-helper`, errorId: `${inputId}-error` };

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
        {leading && (
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-ink-subtle">
            {leading}
          </span>
        )}
        <input
          id={inputId}
          disabled={disabled}
          aria-invalid={error || invalid ? true : undefined}
          aria-describedby={describedBy(ids, helper, error)}
          className={cx(
            controlClasses({ error: Boolean(error) || invalid, disabled }),
            "h-12 px-3.5",
            Boolean(leading) && "pl-9.5",
            Boolean(trailing) && "pr-12",
            inputClassName,
          )}
          {...rest}
        />
        {trailing && (
          <span className="absolute inset-y-0 right-0.5 flex items-center">{trailing}</span>
        )}
      </div>
    </Field>
  );
}
