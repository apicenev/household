import { CheckIcon, ChevronDownIcon, XMarkIcon } from "@heroicons/react/16/solid";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../../lib/cx";

export interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  /** Opens a menu («Fällig: Diese Woche ⌄»): trailing chevron instead of the check. */
  menu?: boolean;
}

const base =
  "inline-flex h-9 shrink-0 cursor-pointer items-center rounded-pill text-body-sm font-semibold whitespace-nowrap transition-colors duration-(--duration-fast) disabled:cursor-not-allowed";

/** Toggleable filter (aria-pressed), 36 px tall. Put several in a <FilterChipGroup>. */
export function FilterChip({
  selected = false,
  menu = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: FilterChipProps) {
  return (
    <button
      type={type}
      aria-pressed={menu ? undefined : selected}
      aria-haspopup={menu ? "menu" : undefined}
      disabled={disabled}
      className={cx(
        base,
        disabled
          ? "bg-sunken px-3.5 text-ink-subtle inset-ring inset-ring-line"
          : selected
            ? "bg-brand-soft text-brand-strong inset-ring inset-ring-brand"
            : "bg-surface text-ink inset-ring inset-ring-line-strong hovered:bg-sunken hovered:inset-ring-control",
        !disabled && (menu ? "gap-1 pr-2.5 pl-3.5" : selected ? "gap-1.5 pr-3.5 pl-2.5" : "px-3.5"),
        className,
      )}
      {...rest}
    >
      {selected && !menu && !disabled && <CheckIcon aria-hidden="true" className="size-4" />}
      {children}
      {menu && <ChevronDownIcon aria-hidden="true" className="size-4" />}
    </button>
  );
}

export interface RemovableChipProps {
  label: string;
  onRemove: () => void;
  /** Leading element, e.g. a 28 px avatar. */
  leading?: ReactNode;
  className?: string;
}

/** Selected value with a remove button («Anna ×»). */
export function RemovableChip({ label, onRemove, leading, className }: RemovableChipProps) {
  return (
    <span
      className={cx(
        base,
        "cursor-default gap-1.5 bg-brand-soft px-1 text-brand-strong inset-ring inset-ring-brand",
        !leading && "pl-3.5",
        className,
      )}
    >
      {leading}
      {label}
      <button
        type="button"
        aria-label={`${label} entfernen`}
        onClick={onRemove}
        className="flex size-7 cursor-pointer items-center justify-center rounded-pill hovered:bg-brand-soft pressed:bg-line"
      >
        <XMarkIcon aria-hidden="true" className="size-4" />
      </button>
    </span>
  );
}

/** Row of chips: 8 px gaps plus 4 px vertical padding so every hit area reaches 44 px. */
export function FilterChipGroup({
  "aria-label": ariaLabel,
  className,
  children,
}: {
  "aria-label": string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={cx("flex flex-wrap gap-2 py-1", className)}>
      {children}
    </div>
  );
}
