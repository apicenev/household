import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "../../lib/cx";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Leading icon (16/solid). */
  icon?: ReactNode;
  /** Text colour when selected (e.g. text-priority-high); default text-ink. */
  selectedClassName?: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
  /** md 40 px (default), sm 36 px, lg 44 px with 15 px text (Schnellerfassung). */
  size?: "md" | "sm" | "lg";
  /** Segments as wide as their content instead of equal widths. */
  fit?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Single choice from a few options (radio group semantics): one tab stop,
 * arrow keys move and select.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  fit = false,
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = options.length - 1;
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={cx(
        "grid grid-flow-col gap-0.5 rounded-control bg-sunken p-0.75",
        fit ? "inline-grid auto-cols-max" : "auto-cols-fr",
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cx(
              "flex cursor-pointer items-center justify-center gap-1.5 rounded-[10px] px-3 font-semibold transition-colors duration-(--duration-fast) focus-visible:-outline-offset-2 disabled:cursor-not-allowed",
              size === "lg" ? "h-11 text-[15px]" : "text-body-sm",
              size === "md" && "h-10",
              size === "sm" && "h-9",
              selected
                ? cx("bg-surface shadow-card", option.selectedClassName ?? "text-ink")
                : "text-ink-muted hovered:text-ink",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
