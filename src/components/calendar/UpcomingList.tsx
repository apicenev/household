import type { ReactNode } from "react";
import type { UpcomingGroup } from "../../domain/calendar";
import { calendarCopy } from "../../lib/copy";
import { cx } from "../../lib/cx";
import type { EventOccurrence, Member } from "../../types";
import { eventCategories } from "../ui/categories";
import { CategoryLabel } from "../ui/CategoryLabel";
import { timeColumn, timeLine, upcomingHeader, upcomingSpan } from "./calendarLabels";
import { NothingPlanned } from "./DayPanel";
import { ParticipantAvatars } from "./ParticipantAvatars";

interface UpcomingListProps {
  groups: UpcomingGroup[];
  todayKey: string;
  timeZone: string;
  members: readonly Member[];
  desktop: boolean;
  emptyAction?: ReactNode;
  /** Phones: open the Termin-Detail (D45); desktop: select the day and expand the card (B9). */
  onOpen: (occurrence: EventOccurrence, dayKey: string) => void;
}

/**
 * «Demnächst» (CAL-03, B9, `Calendar.dc.html`): one section per day with «Heute» (brand) /
 * «Morgen» / weekday and the date, the day's events as rows. Phones: a card per day; desktop:
 * a card with a 140 px date column.
 */
export function UpcomingList(props: UpcomingListProps) {
  const { groups, todayKey, desktop } = props;
  if (groups.length === 0) {
    return (
      <NothingPlanned
        desktop={desktop}
        text={calendarCopy.upcomingEmptyText}
        action={props.emptyAction}
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => {
        const header = upcomingHeader(group.dayKey, todayKey);
        const relative = (
          <span className={header.isToday ? "text-brand-strong" : "text-ink"}>
            {header.relative}
          </span>
        );
        const rows = group.occurrences.map((occurrence, index) => (
          <UpcomingRow
            key={occurrence.key}
            {...props}
            occurrence={occurrence}
            dayKey={group.dayKey}
            first={index === 0}
          />
        ));
        return desktop ? (
          <section
            key={group.dayKey}
            className="grid grid-cols-[140px_minmax(0,1fr)] overflow-hidden rounded-card bg-surface shadow-card"
          >
            <h2 className="flex flex-col gap-0.5 border-r border-line px-4.5 py-3.5 tabular-nums">
              <span className="text-[15px] font-semibold">{relative}</span>
              <span className="text-[13px] font-normal text-ink-muted">{header.date}</span>
            </h2>
            <div>{rows}</div>
          </section>
        ) : (
          <section key={group.dayKey} className="flex flex-col gap-2">
            <h2 className="flex items-baseline gap-2 px-1 text-[15px] font-semibold tabular-nums">
              {relative}
              <span className="font-medium text-ink-muted">{header.date}</span>
            </h2>
            <div className="overflow-hidden rounded-card bg-surface shadow-card">{rows}</div>
          </section>
        );
      })}
    </div>
  );
}

function UpcomingRow({
  occurrence,
  dayKey,
  first,
  timeZone,
  members,
  desktop,
  onOpen,
}: UpcomingListProps & { occurrence: EventOccurrence; dayKey: string; first: boolean }) {
  const { event } = occurrence;
  const span = upcomingSpan(occurrence);
  const style = eventCategories[event.category];
  const Icon = style.icon;
  return (
    <button
      type="button"
      onClick={() => onOpen(occurrence, dayKey)}
      className={cx(
        "flex w-full cursor-pointer items-center text-left text-ink transition-colors duration-(--duration-fast) hovered:bg-sunken",
        !first && "border-t border-line",
        desktop ? "min-h-14 gap-3.5 px-4.5 py-1.5" : "min-h-15 gap-3 px-4 py-2",
      )}
    >
      {desktop ? (
        <>
          <span className="w-24 shrink-0 text-body-sm font-semibold tabular-nums">
            {timeLine(occurrence, dayKey, timeZone)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-medium">{event.title}</span>
            {span && <span className="text-[13px] text-ink-muted">{span}</span>}
          </span>
          <CategoryLabel kind="event" category={event.category} size="sm" />
          <span className="flex w-11 shrink-0 justify-end">
            <ParticipantAvatars participants={event.participants} members={members} size={24} />
          </span>
        </>
      ) : (
        <>
          <span className="w-17 shrink-0 text-body-sm font-semibold tabular-nums">
            {timeColumn(occurrence, dayKey, timeZone).primary}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-body font-medium">{event.title}</span>
            <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-muted">
              <span className={cx("inline-flex items-center gap-1 font-semibold", style.ink)}>
                <Icon aria-hidden="true" className={cx("size-3.5", style.main)} />
                {style.label}
              </span>
              {span && <span>· {span}</span>}
            </span>
          </span>
          <ParticipantAvatars participants={event.participants} members={members} />
        </>
      )}
    </button>
  );
}
