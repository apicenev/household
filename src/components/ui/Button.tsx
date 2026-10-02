import type { ButtonHTMLAttributes, ComponentType, ReactNode, SVGProps } from "react";
import { cx } from "../../lib/cx";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost";
/**
 * md 48 px (default) · lg 52 px (sheet footers, mobile confirmations) ·
 * compact 44 px (sidebar «Neu», empty states, desktop dialogs) · sm 36 px with a 44 px hit area
 */
export type ButtonSize = "md" | "lg" | "compact" | "sm";
type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon (20/solid for md and compact, 16/solid for sm). */
  icon?: Icon;
  /** Trailing icon, e.g. chevron-right on «Alle anzeigen». */
  trailingIcon?: Icon;
  /** Shows a spinner and `loadingLabel` («Speichert…»); the button stays in its colour but can't be pressed. */
  loading?: boolean;
  loadingLabel?: ReactNode;
  fullWidth?: boolean;
}

const variants: Record<ButtonVariant, { idle: string; disabled: string }> = {
  primary: {
    idle: "bg-brand text-on-brand hovered:bg-brand-hover pressed:bg-brand-hover pressed:shadow-pressed",
    disabled: "bg-sunken text-ink-subtle",
  },
  secondary: {
    idle: "bg-surface text-ink inset-ring inset-ring-line-strong hovered:bg-sunken pressed:bg-line",
    disabled: "bg-surface text-ink-subtle inset-ring inset-ring-line",
  },
  ghost: {
    idle: "bg-transparent text-brand-strong hovered:bg-brand-soft pressed:bg-brand-soft pressed:inset-ring pressed:inset-ring-brand",
    disabled: "bg-transparent text-ink-subtle",
  },
  danger: {
    idle: "bg-danger text-on-brand hovered:bg-danger-hover pressed:bg-danger-hover pressed:shadow-pressed-danger focused:outline-danger",
    disabled: "bg-sunken text-ink-subtle",
  },
  // Entry point of a destructive flow («Aufgabe löschen»): ghost with red text.
  "danger-ghost": {
    idle: "bg-transparent text-danger hovered:bg-danger-soft pressed:bg-danger-soft",
    disabled: "bg-transparent text-ink-subtle",
  },
};

function sizeClasses(
  size: ButtonSize,
  ghost: boolean,
  hasIcon: boolean,
  hasTrailing: boolean,
): string {
  if (size === "sm") {
    return cx(
      // 36 px visual, 44 px hit area via the pseudo-element
      "relative h-9 gap-1.5 rounded-[10px] text-body-sm font-semibold before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
      hasTrailing ? "gap-0.5 pr-2 pl-3" : hasIcon ? "pr-3.5 pl-2.5" : "px-3.5",
    );
  }
  if (size === "lg") {
    return cx(
      "h-13 gap-2 rounded-control text-[17px] font-semibold",
      hasIcon ? "pr-6 pl-5" : "px-6",
    );
  }
  if (size === "compact") {
    return cx(
      "h-11 gap-1.5 rounded-control text-[15px] font-semibold",
      hasIcon ? "pr-4 pl-3" : "px-4",
    );
  }
  return cx(
    "h-12 gap-2 rounded-control text-body font-semibold",
    hasIcon ? "pr-5 pl-4" : ghost ? "px-4" : "px-5",
  );
}

export function Button({
  variant = "primary",
  size = "md",
  icon: IconComponent,
  trailingIcon: TrailingIcon,
  loading = false,
  loadingLabel,
  fullWidth = false,
  disabled,
  className,
  children,
  type = "button",
  onClick,
  ...rest
}: ButtonProps) {
  const style = variants[variant];
  const iconSize = size === "sm" ? "size-4" : "size-5";
  const ghost = variant === "ghost" || variant === "danger-ghost";

  return (
    <button
      type={type}
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={loading ? undefined : onClick}
      className={cx(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-[background-color,box-shadow,transform] duration-(--duration-fast) ease-out select-none pressed:scale-[0.97]",
        sizeClasses(size, ghost, Boolean(IconComponent), Boolean(TrailingIcon)),
        disabled && !loading ? cx(style.disabled, "cursor-not-allowed") : style.idle,
        loading ? "cursor-progress" : !disabled && "cursor-pointer",
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner />
          {loadingLabel ?? children}
        </>
      ) : (
        <>
          {IconComponent && <IconComponent aria-hidden="true" className={iconSize} />}
          {children}
          {TrailingIcon && <TrailingIcon aria-hidden="true" className="size-4" />}
        </>
      )}
    </button>
  );
}
