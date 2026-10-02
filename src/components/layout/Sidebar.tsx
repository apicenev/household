import { EllipsisHorizontalIcon, PlusIcon } from "@heroicons/react/20/solid";
import { NavLink } from "react-router-dom";
import { useCurrentMember } from "../../lib/auth/useCurrentMember";
import { memberCountLabel, roleLabels } from "../../lib/copy";
import { useHousehold } from "../../lib/household/useHousehold";
import { cx } from "../../lib/cx";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { AccountMenu } from "./AccountMenu";
import { BrandTile } from "./BrandMark";
import { sidebarItems, type NavItem } from "./navigation";
import { openTaskCount } from "../../domain/tasks";

/**
 * Desktop sidebar (Sidebar.dc.html), 272 px on sunken: brand with the household name, «Neu»,
 * primary and secondary navigation, account footer with the role line («Besitzer · 2
 * Mitglieder»). The open-task count next to Aufgaben (Phase 3 B10); the Einkauf count
 * arrives with Phase 5.
 */
export function Sidebar({ onQuickAdd, className }: { onQuickAdd: () => void; className?: string }) {
  const member = useCurrentMember();
  const { household, members, isOwner, tasks } = useHousehold();
  const counts: Partial<Record<NavItem["key"], number>> = { tasks: openTaskCount(tasks) };
  // Without a household (load error, D8) the footer falls back to the email.
  const roleLine = household
    ? `${isOwner ? roleLabels.owner : roleLabels.member} · ${memberCountLabel(members.length)}`
    : member.email;

  return (
    <aside
      aria-label="Seitenleiste"
      className={cx(
        "sticky top-0 h-dvh w-68 shrink-0 flex-col gap-5 border-r border-line bg-sunken px-4 py-5 text-ink",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 px-2">
        <BrandTile size={36} />
        <span className="flex min-w-0 flex-col">
          <span className="font-display text-[20px] leading-6 font-medium tracking-[-0.01em]">
            Household
          </span>
          {household && (
            <span className="truncate text-caption font-normal text-ink-muted">
              {household.name}
            </span>
          )}
        </span>
      </div>

      <Button size="compact" icon={PlusIcon} onClick={onQuickAdd} className="w-full shadow-card">
        Neu
      </Button>

      <nav aria-label="Hauptnavigation" className="flex flex-col gap-0.5">
        {sidebarItems.primary.map((item) => (
          <SidebarLink key={item.key} item={item} count={counts[item.key]} />
        ))}
        <div role="separator" className="mx-3 my-2.5 h-px bg-line" />
        {sidebarItems.secondary.map((item) => (
          <SidebarLink key={item.key} item={item} />
        ))}
      </nav>

      <div className="mt-auto">
        <AccountMenu
          placement="top"
          align="start"
          trigger={(props) => (
            <button
              {...props}
              type="button"
              aria-label="Kontomenü"
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-control p-2 text-left transition-colors duration-(--duration-fast) hovered:bg-surface"
            >
              <Avatar initials={member.initials} color={member.avatarColor} size={36} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body-sm leading-[18px] font-semibold">
                  {member.name}
                </span>
                <span className="truncate text-caption font-normal text-ink-muted">{roleLine}</span>
              </span>
              <EllipsisHorizontalIcon aria-hidden="true" className="size-5 text-ink-muted" />
            </button>
          )}
        />
      </div>
    </aside>
  );
}

function SidebarLink({ item, count }: { item: NavItem; count?: number }) {
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        cx(
          "flex h-11 items-center gap-3 rounded-control px-3 text-[15px] transition-colors duration-(--duration-fast)",
          isActive
            ? "bg-surface font-semibold text-brand-strong shadow-card"
            : "font-medium text-ink-muted hovered:bg-surface",
        )
      }
    >
      {({ isActive }) => {
        const Icon = isActive ? item.activeIcon : item.icon;
        return (
          <>
            <Icon aria-hidden="true" className="size-5.5" />
            <span className="flex-1">{item.label}</span>
            {count !== undefined && count > 0 && " "}
            {count !== undefined && count > 0 && (
              <span className="min-w-5.5 text-right text-caption font-semibold text-ink-muted tabular-nums">
                {count}
              </span>
            )}
          </>
        );
      }}
    </NavLink>
  );
}
