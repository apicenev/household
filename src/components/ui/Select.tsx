import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { useId, type ReactNode, type SelectHTMLAttributes } from "react";
import { cx } from "../../lib/cx";
import { Field } from "./Field";
import { controlClasses, describedBy } from "./fieldStyles";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label: ReactNode;
  options: SelectOption[];
  optional?: boolean;
  helper?: ReactNode;
  error?: ReactNode;
  /** Leading element for the selected value, e.g. a 28 px avatar. */
  leading?: ReactNode;
  className?: string;
  /** Extra classes for the select itself, e.g. a smaller desktop height. */
  selectClassName?: string;
}

/** Native select (reliable on phones) styled as a field, with an optional leading slot. */
export function Select({
  label,
  options,
  optional,
  helper,
  error,
  leading,
  disabled,
  className,
  selectClassName,
  id,
  ...rest
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const ids = { helperId: `${selectId}-helper`, errorId: `${selectId}-error` };

  return (
    <Field
      label={label}
      optional={optional}
      helper={helper}
      error={error}
      disabled={disabled}
      htmlFor={selectId}
      className={className}
      {...ids}
    >
      <div className="relative">
        {leading && (
          <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
            {leading}
          </span>
        )}
        <select
          id={selectId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(ids, helper, error)}
          className={cx(
            controlClasses({ error: Boolean(error), disabled }),
            "h-12 cursor-pointer appearance-none pr-10 disabled:cursor-not-allowed",
            leading ? "pl-12" : "pl-3.5",
            selectClassName,
          )}
          {...rest}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronUpDownIcon
          aria-hidden="true"
          className={cx(
            "pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2",
            disabled ? "text-ink-subtle" : "text-ink-muted",
          )}
        />
      </div>
    </Field>
  );
}
