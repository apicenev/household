import type { ButtonHTMLAttributes, ComponentType, SVGProps } from "react";
import { cx } from "../../lib/cx";

export type IconButtonVariant = "plain" | "sunken" | "outline" | "danger" | "brand";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Required accessible name, e.g. «Schliessen». */
  "aria-label": string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  variant?: IconButtonVariant;
  /** Icon size in px: 24 (default, 24/outline) or 20 (20/solid in dense rows). */
  iconSize?: 20 | 24;
}

const variants: Record<IconButtonVariant, string> = {
  plain: "bg-transparent text-ink-muted hovered:bg-sunken hovered:text-ink pressed:bg-line",
  sunken: "bg-sunken text-ink hovered:bg-line pressed:bg-line",
  outline:
    "bg-surface text-ink inset-ring inset-ring-line-strong hovered:bg-sunken pressed:bg-line",
  danger: "bg-transparent text-danger hovered:bg-danger-soft pressed:bg-danger-soft",
  // Back button in the pushed top bar
  brand: "bg-transparent text-brand-strong hovered:bg-brand-soft pressed:bg-brand-soft",
};

/** Icon-only button with a 44 px round hit area. */
export function IconButton({
  icon: Icon,
  variant = "plain",
  iconSize = 24,
  className,
  type = "button",
  disabled,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cx(
        "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pill transition-colors duration-(--duration-fast) disabled:cursor-not-allowed disabled:text-ink-subtle",
        variants[variant],
        className,
      )}
      {...rest}
    >
      <Icon aria-hidden="true" className={iconSize === 24 ? "size-6" : "size-5"} />
    </button>
  );
}
