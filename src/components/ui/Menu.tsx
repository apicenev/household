import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  type SVGProps,
} from "react";
import { cx } from "../../lib/cx";

export interface MenuItem {
  label: string;
  /** 24/outline icon, muted (danger items take the text colour). */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export type MenuEntry = MenuItem | "separator";

export interface MenuTriggerProps {
  ref: RefObject<HTMLButtonElement | null>;
  id: string;
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  "aria-controls": string;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

export interface MenuProps {
  /** Renders the trigger button; spread the props onto it. */
  trigger: (props: MenuTriggerProps) => ReactNode;
  items: MenuEntry[];
  /** Accessible name of the menu, e.g. «Kontomenü». */
  "aria-label": string;
  /** Non-interactive block above the items (avatar, name, email). */
  header?: ReactNode;
  /** Horizontal alignment to the trigger (default end = right edges aligned). */
  align?: "start" | "end";
  /** Width in px: 240 (default) or 260 (account menu). */
  width?: 240 | 260;
  /** Opens below the trigger (default) or above it (sidebar footer). */
  placement?: "bottom" | "top";
  className?: string;
}

/**
 * Anchored dropdown (menu button pattern): opens with click, Enter, Space or the arrow keys;
 * arrows / Home / End move, Esc closes and returns focus to the trigger, Tab closes.
 */
export function Menu({
  trigger,
  items,
  "aria-label": ariaLabel,
  header,
  align = "end",
  width = 240,
  placement = "bottom",
  className,
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const [initialFocus, setInitialFocus] = useState<"first" | "last">("first");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();
  const triggerId = useId();

  const enabledIndexes = items
    .map((entry, index) => (entry !== "separator" && !entry.disabled ? index : -1))
    .filter((index) => index >= 0);

  function focusItem(index: number | undefined) {
    if (index !== undefined) itemRefs.current[index]?.focus();
  }

  useEffect(() => {
    if (!open) return;
    focusItem(initialFocus === "first" ? enabledIndexes[0] : enabledIndexes.at(-1));
    // Focus once when opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on a click or tap outside.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close({ restoreFocus }: { restoreFocus: boolean }) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function openWith(focus: "first" | "last") {
    setInitialFocus(focus);
    setOpen(true);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openWith("first");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openWith("last");
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = itemRefs.current.findIndex((element) => element === document.activeElement);
    const position = enabledIndexes.indexOf(current);
    const count = enabledIndexes.length;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusItem(enabledIndexes[(position + 1) % count]);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusItem(enabledIndexes[(position - 1 + count) % count]);
        break;
      case "Home":
        event.preventDefault();
        focusItem(enabledIndexes[0]);
        break;
      case "End":
        event.preventDefault();
        focusItem(enabledIndexes.at(-1));
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        close({ restoreFocus: true });
        break;
      case "Tab":
        close({ restoreFocus: false });
        break;
    }
  }

  function select(item: MenuItem) {
    if (item.disabled) return;
    close({ restoreFocus: true });
    item.onSelect();
  }

  return (
    <div ref={rootRef} className={cx("relative inline-flex", className)}>
      {trigger({
        ref: triggerRef,
        id: triggerId,
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": menuId,
        onClick: () => (open ? close({ restoreFocus: false }) : openWith("first")),
        onKeyDown: handleTriggerKeyDown,
      })}
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={ariaLabel}
          onKeyDown={handleMenuKeyDown}
          className={cx(
            "absolute z-40 flex flex-col rounded-[14px] bg-surface p-1.5 text-ink shadow-raised",
            placement === "top" ? "bottom-full mb-2" : "top-full mt-2",
            align === "end" ? "right-0" : "left-0",
            width === 260 ? "w-65" : "w-60",
          )}
        >
          {header && (
            <>
              <div className="px-2.5 pt-2.5 pb-3">{header}</div>
              <div role="separator" className="mx-1 mb-1 h-px bg-line" />
            </>
          )}
          {items.map((entry, index) => {
            if (entry === "separator") {
              return (
                <div key={`separator-${index}`} role="separator" className="m-1 h-px bg-line" />
              );
            }
            const Icon = entry.icon;
            return (
              <button
                key={entry.label}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-disabled={entry.disabled || undefined}
                onClick={() => select(entry)}
                className={cx(
                  "flex h-11 w-full cursor-pointer items-center gap-3 rounded-[10px] px-2.5 text-left text-[15px] focus-visible:-outline-offset-2 aria-disabled:cursor-not-allowed",
                  entry.disabled
                    ? "text-ink-subtle"
                    : cx("hovered:bg-sunken", entry.danger ? "text-danger" : "text-ink"),
                )}
              >
                {Icon && (
                  <Icon
                    aria-hidden="true"
                    className={cx(
                      "size-6 shrink-0",
                      !entry.danger && !entry.disabled && "text-ink-muted",
                    )}
                  />
                )}
                {entry.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
