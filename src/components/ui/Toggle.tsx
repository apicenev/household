import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../../lib/cx";

export interface ToggleProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange" | "role"
> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Visible label; renders the toggle as a full-width settings row. */
  label?: ReactNode;
  hint?: ReactNode;
}

/** iOS-style switch (51 × 31). With `label` it becomes a 56 px row with the switch on the right. */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
  className,
  onClick,
  ...rest
}: ToggleProps) {
  const track = (
    <span
      aria-hidden="true"
      className={cx(
        "relative inline-block h-7.75 w-12.75 shrink-0 rounded-pill transition-colors duration-(--duration-fast)",
        "group-focused:outline-2 group-focused:outline-offset-2 group-focused:outline-focus group-focused:outline-solid",
        disabled
          ? checked
            ? "bg-brand-soft"
            : "bg-line"
          : checked
            ? "bg-brand"
            : "bg-line-strong",
      )}
    >
      <span
        className={cx(
          "absolute top-0.5 left-0.5 size-6.75 rounded-pill transition-transform duration-(--duration-base) ease-out",
          checked && "translate-x-5",
          disabled ? (checked ? "bg-surface" : "bg-sunken") : "bg-surface shadow-knob",
        )}
      />
    </span>
  );

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onChange(!checked);
      }}
      className={cx(
        "group text-left text-ink focus-visible:outline-none data-[state~=focus]:outline-none",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        label
          ? "flex min-h-14 w-full items-center gap-3 border-b border-line"
          : "inline-flex p-1.5",
        className,
      )}
      {...rest}
    >
      {label ? (
        <>
          <span className="flex flex-1 flex-col">
            <span className={cx("text-body", disabled && "text-ink-subtle")}>{label}</span>
            {hint && <span className="text-[13px] text-ink-muted">{hint}</span>}
          </span>
          {track}
        </>
      ) : (
        track
      )}
    </button>
  );
}
