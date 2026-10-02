import type { ComponentType, ReactNode, SVGProps } from "react";
import { cx } from "../../lib/cx";

export interface EmptyStateProps {
  /** 24/outline icon, shown at 28 px in a 56 px brand-soft circle. */
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: ReactNode;
  text?: ReactNode;
  /** Usually a secondary <Button size="compact">. */
  action?: ReactNode;
  /** Card surface around it (default true); false for full-page use. */
  card?: boolean;
  /** Heading level (default h2). */
  as?: "h1" | "h2" | "h3";
  className?: string;
}

/** Icon + short copy + optional action, centred. */
export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
  card = true,
  as: Heading = "h2",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cx(
        "flex flex-col items-center gap-3 text-center",
        card && "rounded-card bg-surface px-6 py-9 shadow-card",
        className,
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-pill bg-brand-soft text-brand">
        <Icon aria-hidden="true" className="size-7" />
      </div>
      <Heading className="text-heading text-ink">{title}</Heading>
      {text && <p className="max-w-65 text-[15px] leading-[22px] text-ink-muted">{text}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
