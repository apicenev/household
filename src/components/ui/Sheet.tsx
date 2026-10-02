import { XMarkIcon } from "@heroicons/react/24/outline";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { actions } from "../../lib/copy";
import { cx } from "../../lib/cx";
import { IconButton } from "./IconButton";

/** Exit transition length (duration-slow); content stays mounted this long after closing. */
const EXIT_MS = 360;

export interface SheetProps {
  open: boolean;
  /** Called on Esc, the close button, a scrim click or the system back gesture. */
  onClose: () => void;
  /** Dialog title; also its accessible name. */
  title: ReactNode;
  /** Keeps the title for screen readers only (e.g. Schnellerfassung). */
  hideTitle?: boolean;
  /**
   * Hides the title row with the close button; `title` (a string) becomes the aria-label.
   * For layouts that render their own heading (confirmations, Schnellerfassung).
   */
  hideHeader?: boolean;
  /** Short description, announced with the title. */
  description?: ReactNode;
  /** Sticky action row at the bottom (primary action). */
  footer?: ReactNode;
  /** Desktop width: sm 400, md 560 (default), lg 840. */
  size?: "sm" | "md" | "lg";
  /** alertdialog for confirmations. */
  role?: "dialog" | "alertdialog";
  /** Closes on a click on the scrim (default true). */
  closeOnScrim?: boolean;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}

let openSheets = 0;

/**
 * Forms and pickers (UI-07): bottom sheet below lg, centred dialog from lg.
 * Built on the native <dialog> (showModal): focus trap, Esc and inert background come from
 * the browser. Focus returns to the trigger on close. Put `data-autofocus` on the element
 * that should get focus first; otherwise the first focusable element gets it.
 */
export function Sheet({
  open,
  onClose,
  title,
  hideTitle = false,
  hideHeader = false,
  description,
  footer,
  size = "md",
  role = "dialog",
  closeOnScrim = true,
  className,
  bodyClassName,
  children,
}: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [scrolled, setScrolled] = useState(false);

  // Keep the content mounted while the exit transition runs.
  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      const active = document.activeElement;
      returnFocusRef.current = active instanceof HTMLElement ? active : null;
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
      return;
    }

    if (!open && dialog.open) {
      dialog.close();
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (open || !present) return;
    const timer = window.setTimeout(() => setPresent(false), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open, present]);

  // Lock page scroll while any sheet is open.
  useEffect(() => {
    if (!open) return;
    openSheets += 1;
    document.documentElement.style.overflow = "hidden";
    return () => {
      openSheets -= 1;
      if (openSheets === 0) document.documentElement.style.overflow = "";
    };
  }, [open]);

  // Unmounting while open: close the dialog so focus and scroll are restored.
  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  }

  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    // Clicks on the ::backdrop are dispatched to the <dialog> itself.
    if (closeOnScrim && event.target === event.currentTarget) onClose();
  }

  const titleRow = !hideHeader && (
    <div
      className={cx(
        "flex items-center justify-between gap-2 pr-2 pl-5",
        "lg:border-b lg:border-line lg:pt-4 lg:pr-3 lg:pb-3 lg:pl-6",
        scrolled && "border-b border-line pb-1",
      )}
    >
      <h2
        id={titleId}
        className={cx(
          "text-heading text-ink lg:font-display lg:text-[24px] lg:leading-8 lg:font-medium",
          hideTitle && "sr-only",
        )}
      >
        {title}
      </h2>
      <IconButton
        aria-label={actions.close}
        icon={XMarkIcon}
        onClick={onClose}
        className="lg:size-10"
      />
    </div>
  );

  return (
    <dialog
      ref={dialogRef}
      role={role === "alertdialog" ? "alertdialog" : undefined}
      aria-labelledby={hideHeader ? undefined : titleId}
      aria-label={hideHeader && typeof title === "string" ? title : undefined}
      aria-describedby={description ? descriptionId : undefined}
      aria-modal="true"
      onKeyDown={handleKeyDown}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={handleClick}
      className={cx(
        "hh-sheet m-0 max-w-none overflow-hidden border-0 bg-surface p-0 text-ink",
        // Mobile: bottom sheet
        "fixed inset-x-0 top-auto bottom-0 max-h-[calc(100dvh-56px)] w-full rounded-t-sheet shadow-sheet",
        // Desktop: centred dialog
        "lg:inset-0 lg:m-auto lg:h-fit lg:max-h-[min(820px,calc(100dvh-64px))] lg:max-w-[calc(100vw-64px)] lg:rounded-card lg:shadow-raised",
        size === "sm" && "lg:w-100",
        size === "md" && "lg:w-140",
        size === "lg" && "lg:w-210",
        className,
      )}
    >
      {present && (
        <div className="flex max-h-[inherit] flex-col">
          <div className="flex shrink-0 flex-col pt-2 lg:pt-0">
            <span
              aria-hidden="true"
              className="mb-1 h-1.25 w-9 self-center rounded-[3px] bg-line-strong lg:hidden"
            />
            {titleRow}
          </div>
          <div
            onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 0)}
            className={cx(
              "flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-4 pt-1 lg:px-6 lg:py-5",
              footer ? "pb-4" : "pb-[max(--spacing(4),env(safe-area-inset-bottom))]",
              bodyClassName,
            )}
          >
            {description && (
              <p id={descriptionId} className="text-[15px] leading-[22px] text-ink-muted">
                {description}
              </p>
            )}
            {children}
          </div>
          {footer && (
            <div className="flex shrink-0 gap-2 border-t border-line px-4 pt-3 pb-[max(--spacing(3),env(safe-area-inset-bottom))] lg:items-center lg:justify-end lg:px-6 lg:py-3.5">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
