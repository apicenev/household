import type { ComponentType, SVGProps } from "react";
import { cx } from "../../lib/cx";

export interface ComingSoonProps {
  /** Area name, e.g. «Aufgaben». */
  title: string;
  /** The area's own nav icon (24/outline). */
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Heading level (h1 as a page, h2 inside the Schnellerfassung). */
  as?: "h1" | "h2";
  className?: string;
}

/**
 * «Bald verfügbar» (derived screen, Phase 1 §1.1): area icon in a 56 px brand-soft circle,
 * the area name and «Kommt bald.»; no action.
 */
export function ComingSoon({ title, icon: Icon, as: Heading = "h1", className }: ComingSoonProps) {
  return (
    <div className={cx("flex flex-col items-center justify-center gap-3 text-center", className)}>
      <span className="flex size-14 items-center justify-center rounded-pill bg-brand-soft text-brand-strong">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <Heading className="font-display text-title text-ink">{title}</Heading>
      <p className="text-body text-ink-muted">Kommt bald.</p>
    </div>
  );
}
