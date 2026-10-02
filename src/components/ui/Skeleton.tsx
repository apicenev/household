import type { CSSProperties } from "react";
import { loadingLabels } from "../../lib/copy";
import { cx } from "../../lib/cx";

/** One placeholder shape on sunken. Size it with classes (h-3 w-2/5, size-6.5 rounded-pill …). */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden="true" style={style} className={cx("rounded-xs bg-sunken", className)} />;
}

/** Loading card for a list: title bar and rows (checkbox, two lines, avatar), pulsing. */
export function SkeletonList({ rows = 3, className }: { rows?: number; className?: string }) {
  const widths = ["72%", "55%", "64%"];
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={loadingLabels.loading}
      className={cx(
        "flex animate-skeleton flex-col gap-4 rounded-card bg-surface p-4.5 shadow-card",
        className,
      )}
    >
      <Skeleton className="h-3.5 w-2/5" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-6.5 shrink-0 rounded-pill" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3" style={{ width: widths[index % widths.length] }} />
            <Skeleton className="h-2.5 w-[30%]" />
          </div>
          <Skeleton className="size-7 rounded-pill" />
        </div>
      ))}
    </div>
  );
}
