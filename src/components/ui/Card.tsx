import type { HTMLAttributes } from "react";
import { cx } from "../../lib/cx";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * none: rows run edge to edge (list cards, default) · md: 16 px ·
   * lg: 16 px vertical / 20 px horizontal (content cards).
   */
  padding?: "none" | "md" | "lg";
}

/** Surface with radius-card and the card shadow. */
export function Card({ padding = "none", className, ...rest }: CardProps) {
  return (
    <div
      className={cx(
        "rounded-card bg-surface shadow-card",
        padding === "md" && "p-4",
        padding === "lg" && "px-5 py-4",
        className,
      )}
      {...rest}
    />
  );
}
