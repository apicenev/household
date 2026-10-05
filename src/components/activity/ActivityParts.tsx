import {
  CalendarIcon,
  CheckCircleIcon,
  PlusCircleIcon,
  ShoppingBagIcon,
  UserIcon,
  UserPlusIcon,
} from "@heroicons/react/16/solid";
import { BoltIcon } from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";
import {
  ACTIVITY_FILTERS,
  actorOf,
  type ActivityFilter,
  type ActivityRow,
} from "../../domain/activity";
import { activityCopy } from "../../lib/copy";
import { cx } from "../../lib/cx";
import type { Member } from "../../types";
import { RepeatLabel } from "../calendar/EventCard";
import { Avatar } from "../ui/Avatar";
import { FilterChip } from "../ui/FilterChip";
import type { ActivityIconKind, ActivityLine, SubLine } from "./activityLabels";

/** The feed's parts (`Activity.dc.html`, Phase 8 D77–D82). */

const icons: Record<
  ActivityIconKind,
  { Icon: ComponentType<SVGProps<SVGSVGElement>>; color: string }
> = {
  taskDone: { Icon: CheckCircleIcon, color: "text-brand" },
  taskCreated: { Icon: PlusCircleIcon, color: "text-brand" },
  assign: { Icon: UserIcon, color: "text-ink-muted" },
  shop: { Icon: ShoppingBagIcon, color: "text-shop-groceries" },
  event: { Icon: CalendarIcon, color: "text-event-social" },
  member: { Icon: UserPlusIcon, color: "text-success" },
};

/** «Alle / Aufgaben / Einkauf / Kalender / Mitglieder» (ACT-08); phones scroll sideways. */
export function ActivityFilters({
  value,
  onChange,
}: {
  value: ActivityFilter;
  onChange: (filter: ActivityFilter) => void;
}) {
  return (
    <div
      role="group"
      aria-label={activityCopy.filterLabel}
      className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 py-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
    >
      {ACTIVITY_FILTERS.map((filter) => (
        <FilterChip key={filter} selected={value === filter} onClick={() => onChange(filter)}>
          {activityCopy.filters[filter]}
        </FilterChip>
      ))}
    </div>
  );
}

/** 36 px avatar with the 20 px type badge; «?» on sunken for a former member (D82). */
function ActorAvatar({ member, icon }: { member: Member | null; icon: ActivityIconKind }) {
  const { Icon, color } = icons[icon];
  return (
    <span className="relative shrink-0">
      {member ? (
        <Avatar initials={member.initials} color={member.avatarColor} size={36} />
      ) : (
        <span
          aria-hidden="true"
          className="inline-flex size-9 items-center justify-center rounded-pill bg-sunken text-[13px] font-[650] text-ink-muted"
        >
          ?
        </span>
      )}
      <span
        aria-hidden="true"
        className={cx(
          "absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-pill bg-surface",
          color,
        )}
      >
        <Icon className="size-3.5" />
      </span>
    </span>
  );
}

export function ActivityRowView({
  row,
  line,
  sub,
  time,
  members,
  desktop,
  first,
}: {
  row: ActivityRow;
  line: ActivityLine;
  sub: SubLine | null;
  time: string;
  members: readonly Member[];
  desktop: boolean;
  first: boolean;
}) {
  const actorId = row.kind === "single" ? row.entry.actorId : row.entries[0].actorId;
  return (
    <li
      className={cx(
        "flex items-start",
        desktop ? "gap-3.5 py-3.5" : "gap-3 py-3",
        !first && "border-t border-line",
      )}
    >
      <ActorAvatar member={actorOf(actorId, members)} icon={line.icon} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cx(
            "text-[15px] text-ink-muted",
            desktop ? "leading-[22px]" : "leading-[21px]",
          )}
        >
          <strong className="font-semibold text-ink">{line.who}</strong> {line.verb}{" "}
          <span className="font-medium text-ink">{line.what}</span>
          {line.tail}
        </span>
        {sub && (
          <span className="flex flex-wrap items-center gap-x-1 text-[13px] leading-[18px] text-ink-muted">
            {sub.text}
            {sub.repeat && (
              <span className="inline-flex items-center gap-1">
                · <RepeatLabel text={sub.repeat} />
              </span>
            )}
          </span>
        )}
      </span>
      {desktop && (
        <span className="flex h-6 shrink-0 items-center rounded-xs bg-sunken px-2 text-caption font-semibold text-ink-muted">
          {line.typeLabel}
        </span>
      )}
      <span
        className={cx(
          "shrink-0 text-[13px] text-ink-subtle tabular-nums",
          desktop ? "w-11 pt-0.75 text-right" : "pt-0.5",
        )}
      >
        {time}
      </span>
    </li>
  );
}

/** «Noch nichts passiert» (`Activity.dc.html`), also for an empty filter. */
export function ActivityEmpty() {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
      <BoltIcon aria-hidden="true" className="size-7 text-ink-subtle" />
      <p className="text-body font-semibold text-ink">{activityCopy.empty}</p>
    </div>
  );
}
