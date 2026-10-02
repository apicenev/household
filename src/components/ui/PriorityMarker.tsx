import { FlagIcon } from "@heroicons/react/16/solid";
import { priorityLabels } from "../../lib/copy";
import { cx } from "../../lib/cx";

export type Priority = "low" | "medium" | "high";

const priorityText: Record<Priority, string> = {
  low: "text-priority-low",
  medium: "text-priority-medium",
  high: "text-priority-high",
};

export interface PriorityMarkerProps {
  priority: Priority;
  /** row: 12 px in list rows · detail: 13 px in details and the sheet (default). */
  size?: "row" | "detail";
  className?: string;
}

/** Flag + label (Hoch / Mittel / Niedrig): colour is never the only cue. */
export function PriorityMarker({ priority, size = "detail", className }: PriorityMarkerProps) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center font-semibold",
        size === "row" ? "gap-0.75 text-caption" : "gap-1 text-[13px]",
        priorityText[priority],
        className,
      )}
    >
      <FlagIcon aria-hidden="true" className={size === "row" ? "size-3.5" : "size-4"} />
      <span>
        <span className="sr-only">Priorität </span>
        {priorityLabels[priority]}
      </span>
    </span>
  );
}
