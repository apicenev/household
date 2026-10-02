import { CheckIcon } from "@heroicons/react/16/solid";
import type { ButtonHTMLAttributes } from "react";
import { cx } from "../../lib/cx";

export interface CheckboxProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange" | "role"
> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name, usually the task or item title. */
  "aria-label": string;
  /** Red ring for overdue tasks. */
  overdue?: boolean;
  /** Spinning ring while a write is pending. */
  syncing?: boolean;
}

/**
 * Round checkbox: 26 px visual in a 44 px hit area. Checking fills the ring in 160 ms and
 * springs the tick in over 360 ms.
 */
export function Checkbox({
  checked,
  onChange,
  overdue = false,
  syncing = false,
  disabled,
  className,
  onClick,
  ...rest
}: CheckboxProps) {
  const interactive = !disabled && !syncing;

  const ring = syncing
    ? "animate-spinner border-brand border-r-transparent"
    : disabled
      ? "border-line-strong bg-sunken"
      : checked
        ? "border-brand bg-brand text-on-brand"
        : cx(
            overdue ? "border-danger" : "border-control",
            "text-brand group-hovered:border-brand group-hovered:bg-brand-soft group-pressed:scale-[0.86] group-pressed:border-brand group-pressed:bg-brand-soft",
          );

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-busy={syncing || undefined}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (interactive && !event.defaultPrevented) onChange(!checked);
      }}
      className={cx(
        "group flex size-11 shrink-0 items-center justify-center rounded-pill focus-visible:outline-none data-[state~=focus]:outline-none",
        interactive ? "cursor-pointer" : "cursor-not-allowed",
        syncing && "cursor-progress",
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={cx(
          "flex size-6.5 items-center justify-center rounded-pill border-2 transition-[background-color,border-color,transform] duration-(--duration-fast) ease-out",
          "group-focused:outline-2 group-focused:outline-offset-3 group-focused:outline-focus group-focused:outline-solid",
          ring,
        )}
      >
        {!syncing && (
          <CheckIcon
            className={cx(
              "size-4 transition-[transform,opacity] duration-(--duration-slow) ease-spring",
              checked
                ? "scale-100 opacity-100"
                : "scale-20 opacity-0 group-hovered:scale-100 group-hovered:opacity-50",
              disabled && !checked && "hidden",
            )}
          />
        )}
      </span>
    </button>
  );
}
