import {
  useId,
  useState,
  type ChangeEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cx } from "../../lib/cx";
import { Field } from "./Field";
import { controlClasses, describedBy } from "./fieldStyles";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode;
  optional?: boolean;
  helper?: ReactNode;
  error?: ReactNode;
  /** Shows the «58 / 500» counter when `maxLength` is set (default true). */
  showCount?: boolean;
  className?: string;
}

export function Textarea({
  label,
  optional,
  helper,
  error,
  showCount = true,
  maxLength,
  disabled,
  className,
  id,
  value,
  defaultValue,
  onChange,
  ...rest
}: TextareaProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const ids = { helperId: `${inputId}-helper`, errorId: `${inputId}-error` };
  const counterId = `${inputId}-count`;
  const [uncontrolledLength, setUncontrolledLength] = useState(String(defaultValue ?? "").length);
  const length = value !== undefined ? String(value).length : uncontrolledLength;
  const counted = showCount && maxLength !== undefined;

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    if (value === undefined) setUncontrolledLength(event.target.value.length);
    onChange?.(event);
  }

  const described = [describedBy(ids, helper, error), counted ? counterId : undefined]
    .filter(Boolean)
    .join(" ");

  return (
    <Field
      label={label}
      optional={optional}
      helper={helper}
      error={error}
      disabled={disabled}
      htmlFor={inputId}
      className={className}
      aside={
        counted && (
          <span
            id={counterId}
            className="self-end text-caption font-normal text-ink-subtle tabular-nums"
          >
            {length} / {maxLength}
          </span>
        )
      }
      {...ids}
    >
      <textarea
        id={inputId}
        disabled={disabled}
        maxLength={maxLength}
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        aria-invalid={error ? true : undefined}
        aria-describedby={described || undefined}
        className={cx(
          controlClasses({ error: Boolean(error), disabled }),
          "block min-h-24 resize-y px-3.5 py-3 leading-6",
        )}
        {...rest}
      />
    </Field>
  );
}
