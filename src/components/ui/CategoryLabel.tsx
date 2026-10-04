import { cx } from "../../lib/cx";
import {
  eventCategories,
  shopCategories,
  type EventCategory,
  type ShopCategory,
} from "./categories";

export type CategoryLabelProps = (
  { kind: "event"; category: EventCategory } | { kind: "shop"; category: ShopCategory }
) & {
  /**
   * pill: soft background, icon + label (default) · dot: 10 px dot + label ·
   * legend: 6 px dot + small muted label (month grid legend).
   */
  variant?: "pill" | "dot" | "legend";
  /** Pill only: md 28 px (default) · sm 24 px with 12 px text (calendar cards and rows). */
  size?: "md" | "sm";
  className?: string;
};

/** Category = dot or icon + label, never colour alone. */
export function CategoryLabel(props: CategoryLabelProps) {
  const { variant = "pill", size = "md", className } = props;
  const style =
    props.kind === "event" ? eventCategories[props.category] : shopCategories[props.category];
  const Icon = style.icon;

  if (variant === "dot" || variant === "legend") {
    const legend = variant === "legend";
    return (
      <span
        className={cx(
          "inline-flex items-center",
          legend
            ? "gap-1.25 text-caption font-normal text-ink-muted"
            : "gap-2 text-body-sm font-semibold text-ink",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className={cx("shrink-0 rounded-pill", legend ? "size-1.5" : "size-2.5", style.dot)}
        />
        {style.label}
      </span>
    );
  }

  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center rounded-pill font-semibold whitespace-nowrap",
        size === "sm"
          ? "h-6 gap-1.25 pr-2 pl-1.5 text-caption"
          : "h-7 gap-1.5 pr-2.5 pl-2 text-[13px]",
        style.pill,
        className,
      )}
    >
      <Icon aria-hidden="true" className={cx(size === "sm" ? "size-3.5" : "size-4", style.main)} />
      {style.label}
    </span>
  );
}
