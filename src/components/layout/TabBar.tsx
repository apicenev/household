import { PlusIcon } from "@heroicons/react/24/outline";
import { NavLink } from "react-router-dom";
import { areas } from "../../lib/copy";
import { cx } from "../../lib/cx";
import { tabItems, type NavItem } from "./navigation";

/**
 * Mobile tab bar (TabBar.dc.html): Start · Aufgaben · + · Einkauf · Kalender.
 * Active tab: 24/solid icon, brand-strong, weight 600, aria-current="page".
 * The raised centre + opens the Schnellerfassung.
 */
export function TabBar({ onQuickAdd, className }: { onQuickAdd: () => void; className?: string }) {
  return (
    <nav
      aria-label="Hauptnavigation"
      className={cx(
        "fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-start bg-surface px-2 pt-1.5 pb-[max(--spacing(2),env(safe-area-inset-bottom))] shadow-bar",
        className,
      )}
    >
      {tabItems.left.map((item) => (
        <Tab key={item.key} item={item} />
      ))}
      <div className="flex justify-center">
        <button
          type="button"
          aria-label={areas.quickAdd}
          onClick={onQuickAdd}
          className="-mt-5 box-content flex size-14 cursor-pointer items-center justify-center rounded-pill border-4 border-surface bg-brand text-on-brand shadow-raised transition-[background-color,transform] duration-(--duration-fast) ease-out hovered:bg-brand-hover pressed:scale-[0.92]"
        >
          <PlusIcon aria-hidden="true" className="size-7" />
        </button>
      </div>
      {tabItems.right.map((item) => (
        <Tab key={item.key} item={item} />
      ))}
    </nav>
  );
}

function Tab({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        cx(
          "flex h-13 min-w-11 flex-col items-center justify-center gap-0.75 rounded-control transition-transform duration-(--duration-instant) focus-visible:-outline-offset-2 pressed:scale-[0.94]",
          isActive ? "text-brand-strong" : "text-ink-muted",
        )
      }
    >
      {({ isActive }) => {
        const Icon = isActive ? item.activeIcon : item.icon;
        return (
          <>
            <Icon aria-hidden="true" className="size-6" />
            <span
              className={cx(
                "text-[11px] leading-[14px] tracking-[0.01em]",
                isActive ? "font-semibold" : "font-medium",
              )}
            >
              {item.label}
            </span>
          </>
        );
      }}
    </NavLink>
  );
}
