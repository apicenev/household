import { ArrowPathIcon, ArrowsRightLeftIcon } from "@heroicons/react/16/solid";
import { cx } from "../../lib/cx";

export interface RecurrenceBadgeProps {
  /** «Alle 2 Wochen», «Jeden Samstag» … */
  rule?: string;
  /** Rotation order, shown as «Nevio → Anna». */
  rotation?: string[];
  /** inline: muted text with icons (rows, default) · pill: sunken pill (details). */
  variant?: "inline" | "pill";
  className?: string;
}

/** «↻ Alle 2 Wochen» and/or «⇄ Nevio → Anna». */
export function RecurrenceBadge({
  rule,
  rotation,
  variant = "inline",
  className,
}: RecurrenceBadgeProps) {
  const rotationText = rotation && rotation.length > 1 ? rotation.join(" → ") : undefined;

  if (variant === "pill") {
    return (
      <span
        className={cx(
          "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-pill bg-sunken pr-2.5 pl-2 text-[13px] font-semibold whitespace-nowrap text-ink",
          className,
        )}
      >
        <ArrowPathIcon aria-hidden="true" className="size-4 text-ink-muted" />
        {[rule, rotationText].filter(Boolean).join(" · ")}
      </span>
    );
  }

  return (
    <span
      className={cx(
        "inline-flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-medium text-ink-muted",
        className,
      )}
    >
      {rule && (
        <span className="inline-flex items-center gap-1">
          <ArrowPathIcon aria-hidden="true" className="size-4" />
          {rule}
        </span>
      )}
      {rotationText && (
        <span className="inline-flex items-center gap-1">
          <ArrowsRightLeftIcon aria-hidden="true" className="size-4" />
          <span className="sr-only">Abwechselnd: </span>
          {rotationText}
        </span>
      )}
    </span>
  );
}
