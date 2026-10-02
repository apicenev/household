import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  SignalSlashIcon,
} from "@heroicons/react/20/solid";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { cx } from "../../lib/cx";

export type AlertTone = "warning" | "danger" | "success" | "info";

const tones: Record<
  AlertTone,
  { box: string; icon: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; role: string }
> = {
  // Offline banner
  warning: { box: "bg-warning-soft", icon: "text-warning", Icon: SignalSlashIcon, role: "status" },
  danger: {
    box: "bg-danger-soft",
    icon: "text-danger",
    Icon: ExclamationTriangleIcon,
    role: "alert",
  },
  success: { box: "bg-success-soft", icon: "text-success", Icon: CheckCircleIcon, role: "status" },
  info: { box: "bg-sunken", icon: "text-ink-muted", Icon: InformationCircleIcon, role: "note" },
};

export interface InlineAlertProps {
  tone: AlertTone;
  /** Bold lead-in, e.g. «Keine Verbindung». */
  title?: ReactNode;
  children?: ReactNode;
  /** Text button on the right («Nochmals versuchen»). */
  action?: { label: string; onClick: () => void };
  /** Override the default icon. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  className?: string;
}

/** Inline message on a soft tone background; errors use role="alert". */
export function InlineAlert({ tone, title, children, action, icon, className }: InlineAlertProps) {
  const style = tones[tone];
  const Icon = icon ?? style.Icon;
  const centred = Boolean(action) || !title;

  return (
    <div
      role={style.role}
      className={cx(
        "flex gap-2.5 rounded-control py-3 text-body-sm text-ink",
        action ? "pr-2 pl-3.5" : "px-3.5",
        centred ? "items-center" : "items-start",
        style.box,
        className,
      )}
    >
      <Icon aria-hidden="true" className={cx("size-5 shrink-0", style.icon)} />
      <span className="flex-1">
        {title && <strong className="font-semibold">{title}</strong>}
        {title && children && " – "}
        {children}
      </span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={cx(
            "h-9 shrink-0 cursor-pointer rounded-[10px] px-3 text-body-sm font-semibold hovered:bg-surface/60",
            tone === "danger" ? "text-danger" : "text-brand-strong",
          )}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
