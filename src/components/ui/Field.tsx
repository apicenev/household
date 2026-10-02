import { ExclamationCircleIcon } from "@heroicons/react/16/solid";
import type { ReactNode } from "react";
import { cx } from "../../lib/cx";

export interface FieldProps {
  label: ReactNode;
  /** Adds «(optional)» after the label. */
  optional?: boolean;
  helper?: ReactNode;
  error?: ReactNode;
  disabled?: boolean;
  /** id of the control; the label is wired to it. */
  htmlFor: string;
  helperId: string;
  errorId: string;
  /** Rendered after helper/error, e.g. the textarea counter. */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Label + control + helper / error, shared by all form fields. */
export function Field({
  label,
  optional,
  helper,
  error,
  disabled,
  htmlFor,
  helperId,
  errorId,
  aside,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className={cx("text-body-sm font-semibold", disabled ? "text-ink-muted" : "text-ink")}
      >
        {label}
        {optional && <span className="font-normal text-ink-muted"> (optional)</span>}
      </label>
      {children}
      {error ? (
        <span
          id={errorId}
          className="flex items-center gap-1.5 text-[13px] leading-[18px] font-medium text-danger"
        >
          <ExclamationCircleIcon aria-hidden="true" className="size-4 shrink-0" />
          {error}
        </span>
      ) : helper ? (
        <span id={helperId} className="text-[13px] leading-[18px] text-ink-muted">
          {helper}
        </span>
      ) : null}
      {aside}
    </div>
  );
}
