import { CheckCircleIcon, ExclamationCircleIcon, SignalSlashIcon } from "@heroicons/react/16/solid";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { cx } from "../../lib/cx";

export type BadgeVariant = "neutral" | "brand" | "success" | "warning" | "danger";

const variants: Record<
  BadgeVariant,
  { className: string; icon?: ComponentType<SVGProps<SVGSVGElement>> }
> = {
  // «Besitzer», signed-in email
  neutral: { className: "bg-sunken text-ink-muted" },
  // «Du», «Als Nächstes»
  brand: { className: "bg-brand-soft text-brand-strong" },
  // «Erledigt»
  success: { className: "bg-success-soft text-success", icon: CheckCircleIcon },
  // «Offline»
  warning: { className: "bg-warning-soft text-warning", icon: SignalSlashIcon },
  // «Überfällig · 1 Tag»
  danger: { className: "bg-danger-soft text-danger", icon: ExclamationCircleIcon },
};

export interface BadgeProps {
  variant?: BadgeVariant;
  /** Hides the variant's default icon. */
  noIcon?: boolean;
  className?: string;
  children: ReactNode;
}

/** Small tag (24 px, radius-xs). Status variants carry an icon, never colour alone. */
export function Badge({ variant = "neutral", noIcon = false, className, children }: BadgeProps) {
  const { className: variantClass, icon: Icon } = variants[variant];
  const showIcon = Icon && !noIcon;
  return (
    <span
      className={cx(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-xs pr-2 text-caption font-semibold whitespace-nowrap",
        showIcon ? "pl-1.5" : "pl-2",
        variantClass,
        className,
      )}
    >
      {showIcon && <Icon aria-hidden="true" className="size-3.5" />}
      {children}
    </span>
  );
}

/** Numeric count on brand (sidebar, filters): 20 px pill. */
export function CountBadge({
  count,
  "aria-label": ariaLabel,
  className,
}: {
  count: number;
  "aria-label"?: string;
  className?: string;
}) {
  return (
    <span
      aria-label={ariaLabel}
      className={cx(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-brand px-1.5 text-caption font-bold text-on-brand tabular-nums",
        className,
      )}
    >
      {count}
    </span>
  );
}
