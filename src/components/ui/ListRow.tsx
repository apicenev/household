import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../../lib/cx";

export interface ListRowProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  /** Second line (13 px, muted): due date, recurrence … */
  meta?: ReactNode;
  /** 44 px slot on the left, usually a <Checkbox>. */
  leading?: ReactNode;
  /** Right side: priority, avatar, quantity … */
  trailing?: ReactNode;
  /** Done: title muted and struck through. */
  done?: boolean;
  disabled?: boolean;
  /** Hover / pressed backgrounds for rows that open something. */
  interactive?: boolean;
  /** md: min 56 px (default) · lg: min 60 px (shopping, component sheet). */
  size?: "md" | "lg";
  /** Divider from the text start to the right edge (default true; hide on the last row). */
  divider?: boolean;
}

/**
 * Row inside a card: 4 px left inset so the 44 px checkbox lines up with the section title,
 * 8 px to the text, divider starting at the text.
 */
export function ListRow({
  title,
  meta,
  leading,
  trailing,
  done = false,
  disabled = false,
  interactive = false,
  size = "md",
  divider = true,
  className,
  ...rest
}: ListRowProps) {
  return (
    <div
      aria-disabled={disabled || undefined}
      className={cx(
        "relative flex items-center gap-2 py-1.5 pr-3.5",
        leading ? "pl-1" : "pl-4",
        size === "lg" ? "min-h-15" : "min-h-14",
        interactive &&
          "cursor-pointer transition-colors duration-(--duration-fast) hovered:bg-sunken pressed:bg-line",
        disabled && "opacity-50",
        className,
      )}
      {...rest}
    >
      {leading}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-1">
        <span
          className={cx(
            "text-body leading-[22px] font-medium transition-colors duration-(--duration-base)",
            done ? "text-ink-subtle line-through" : "text-ink",
          )}
        >
          {title}
        </span>
        {meta && (
          <span className="flex flex-wrap items-center gap-1.5 text-[13px] leading-[18px] text-ink-muted">
            {meta}
          </span>
        )}
      </div>
      {trailing}
      {divider && (
        <span
          aria-hidden="true"
          className={cx("absolute right-0 bottom-0 h-px bg-line", leading ? "left-13" : "left-4")}
        />
      )}
    </div>
  );
}
