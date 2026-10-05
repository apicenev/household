import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { PlusIcon } from "@heroicons/react/20/solid";
import { CalendarIcon } from "@heroicons/react/24/outline";
import type { UpcomingRow } from "../../domain/dashboard";
import { actions, calendarCopy, dashboardCopy, shoppingCopy, terms } from "../../lib/copy";
import { cx } from "../../lib/cx";
import type { Member, ShoppingItem } from "../../types";
import { repeatLabel } from "../calendar/calendarLabels";
import { RepeatLabel } from "../calendar/EventCard";
import { ParticipantAvatars } from "../calendar/ParticipantAvatars";
import { CategoryLabel } from "../ui/CategoryLabel";
import { Checkbox } from "../ui/Checkbox";
import { InlineAlert } from "../ui/InlineAlert";
import { eventCategories, shopCategories } from "../ui/categories";
import { DashboardSection, EmptyLine, SectionLink } from "./DashboardParts";
import { upcomingDateColumn, upcomingWhen } from "./dashboardLabels";

/** «Einkauf» and «Demnächst» on Start (`Dashboard.dc.html`, D70, D71, D75). */

export function ShoppingSection({
  items,
  openCount,
  desktop,
  checking,
  onToggle,
  onOpen,
  onAdd,
  error,
  onRetry,
}: {
  items: ShoppingItem[];
  openCount: number;
  desktop: boolean;
  checking: ReadonlySet<string>;
  onToggle: (itemId: string) => void;
  /** «Artikel bearbeiten» (D73 / D34). */
  onOpen: (itemId: string) => void;
  /** The Schnellerfassung on «Einkauf» (B7, D75). */
  onAdd: () => void;
  error: boolean;
  onRetry: () => void;
}) {
  const addButton = desktop ? (
    // D75: styled as the designed field, opens the Schnellerfassung.
    <div className="px-4 pt-1 pb-2">
      <button
        type="button"
        onClick={onAdd}
        className="flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-control bg-sunken px-3 text-[15px] text-ink-subtle hovered:text-ink-muted"
      >
        <PlusIcon aria-hidden="true" className="size-5" />
        {dashboardCopy.addItem}
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={onAdd}
      className="flex h-12 w-full cursor-pointer items-center gap-2.5 border-t border-line px-4 text-[15px] text-ink-muted hovered:bg-sunken"
    >
      <PlusIcon aria-hidden="true" className="mx-0.5 ml-0.75 size-5" />
      {dashboardCopy.addItem}
    </button>
  );

  const rows = (
    <ul>
      {items.map((item, index) => {
        const ticked = checking.has(item.id);
        const category = shopCategories[item.category];
        const name = (
          <span
            className={cx(
              "font-medium transition-colors duration-(--duration-base)",
              desktop ? "text-[15px]" : "text-body",
              ticked ? "text-ink-subtle line-through" : "text-ink",
            )}
          >
            {item.name}
          </span>
        );
        return (
          <li
            key={item.id}
            onClick={() => onOpen(item.id)}
            className={cx(
              "relative flex cursor-pointer items-center gap-2",
              desktop
                ? "min-h-13 border-t border-line py-0.5 pr-5 pl-2 hovered:bg-sunken"
                : "min-h-14 py-1 pr-4 pl-1",
            )}
          >
            {!desktop && index > 0 && (
              <span aria-hidden="true" className="absolute top-0 right-0 left-13 h-px bg-line" />
            )}
            <Checkbox
              checked={ticked}
              onChange={() => onToggle(item.id)}
              onClick={(event) => event.stopPropagation()}
              aria-label={shoppingCopy.checkLabel(item.name)}
              size={desktop ? "sm" : "md"}
            />
            <button
              type="button"
              className="flex min-w-0 flex-1 cursor-pointer flex-col text-left focus-visible:outline-offset-2"
            >
              {name}
              {desktop && (
                <span className="inline-flex items-center gap-1.25 text-caption font-normal text-ink-muted">
                  <span aria-hidden="true" className={cx("size-1.75 rounded-pill", category.dot)} />
                  {category.label}
                </span>
              )}
            </button>
            {item.quantity && (
              <span className="shrink-0 text-body-sm text-ink-muted tabular-nums">
                {item.quantity}
              </span>
            )}
            {!desktop && (
              <span className="inline-flex min-w-19.5 shrink-0 items-center justify-end gap-1.25 text-caption text-ink-muted">
                <span aria-hidden="true" className={cx("size-2 rounded-pill", category.dot)} />
                {category.label}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <DashboardSection
      title={dashboardCopy.shopping}
      count={
        error
          ? undefined
          : openCount > 0
            ? dashboardCopy.openCount(openCount)
            : dashboardCopy.allBought
      }
      action={<SectionLink to="/shopping">{dashboardCopy.showAll}</SectionLink>}
      desktop={desktop}
    >
      {error ? (
        <InlineAlert
          tone="danger"
          action={{ label: actions.retry, onClick: onRetry }}
          className="m-3"
        >
          {shoppingCopy.loadError}
        </InlineAlert>
      ) : (
        <>
          {desktop && addButton}
          {items.length === 0 ? (
            <EmptyLine desktop={desktop}>{dashboardCopy.emptyShopping}</EmptyLine>
          ) : (
            rows
          )}
          {!desktop && addButton}
        </>
      )}
    </DashboardSection>
  );
}

export function UpcomingSection({
  rows,
  today,
  timeZone,
  members,
  desktop,
  onOpen,
  error,
  onRetry,
}: {
  rows: UpcomingRow[];
  today: string;
  timeZone: string;
  members: readonly Member[];
  desktop: boolean;
  /** The Termin-Detail / the calendar with the card open (D71). */
  onOpen: (occurrenceKey: string) => void;
  error: boolean;
  onRetry: () => void;
}) {
  let body;
  if (error) {
    body = (
      <InlineAlert
        tone="danger"
        action={{ label: actions.retry, onClick: onRetry }}
        className="m-3"
      >
        {calendarCopy.loadError}
      </InlineAlert>
    );
  } else if (rows.length === 0) {
    body = (
      <div
        className={cx(
          "flex flex-col items-center gap-2 px-5 text-center",
          desktop ? "pt-3 pb-7" : "py-6",
        )}
      >
        <CalendarIcon aria-hidden="true" className="size-7 text-ink-subtle" />
        <span className="text-body font-semibold">{dashboardCopy.nothingPlanned}</span>
        <span className="text-body-sm text-ink-muted">{dashboardCopy.upcomingEmptyText}</span>
      </div>
    );
  } else {
    body = (
      <ul>
        {rows.map((row, index) => {
          const { occurrence, dayKey } = row;
          const { event } = occurrence;
          const date = upcomingDateColumn(dayKey);
          const when = upcomingWhen(row, today, timeZone);
          const repeat = repeatLabel(occurrence);
          const style = eventCategories[event.category];
          const Icon = style.icon;
          const dateColumn = (
            <span
              className={cx(
                "flex shrink-0 flex-col items-center tabular-nums",
                desktop ? "w-9" : "w-10",
              )}
            >
              <span className="text-[11px] font-semibold tracking-[0.04em] text-ink-muted uppercase">
                {date.weekday}
              </span>
              <span
                className={cx(
                  "leading-6 font-semibold text-ink",
                  desktop ? "text-[19px]" : "text-[20px]",
                )}
              >
                {date.day}
              </span>
            </span>
          );
          return (
            <li key={`${occurrence.key}-${dayKey}`} className="relative">
              {!desktop && index > 0 && (
                <span aria-hidden="true" className="absolute top-0 right-0 left-16 h-px bg-line" />
              )}
              <button
                type="button"
                onClick={() => onOpen(occurrence.key)}
                className={cx(
                  "flex w-full cursor-pointer text-left text-ink transition-colors duration-(--duration-fast) hovered:bg-sunken",
                  desktop
                    ? "gap-3 border-t border-line px-5 py-3"
                    : "min-h-16 items-center gap-3 py-2 pr-4 pl-3",
                )}
              >
                {dateColumn}
                {desktop ? (
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[15px] leading-5 font-medium">{event.title}</span>
                    <span className="flex flex-wrap items-center gap-1 text-[13px] text-ink-muted tabular-nums">
                      {when}
                      {repeat && (
                        <span className="inline-flex items-center gap-0.75">
                          · <RepeatLabel text={repeat} />
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <CategoryLabel kind="event" category={event.category} size="sm" />
                      <ParticipantAvatars
                        participants={event.participants}
                        members={members}
                        size={24}
                      />
                    </span>
                  </span>
                ) : (
                  <>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.75">
                      <span className="text-body leading-[21px] font-medium">{event.title}</span>
                      <span className="flex flex-wrap items-center gap-1.5 text-[13px] leading-[18px] text-ink-muted tabular-nums">
                        <span
                          className={cx("inline-flex items-center gap-1 font-semibold", style.ink)}
                        >
                          <Icon aria-hidden="true" className={cx("size-3.5", style.main)} />
                          {style.label}
                        </span>
                        <span>· {when}</span>
                        {repeat && (
                          <span className="inline-flex">
                            <ArrowPathIcon aria-hidden="true" className="size-3.5" />
                            <span className="sr-only">{repeat}</span>
                          </span>
                        )}
                      </span>
                    </span>
                    <ParticipantAvatars participants={event.participants} members={members} />
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <DashboardSection
      title={terms.upcoming}
      count={desktop ? dashboardCopy.sevenDays : dashboardCopy.nextSevenDays}
      action={<SectionLink to="/calendar">{dashboardCopy.calendar}</SectionLink>}
      desktop={desktop}
    >
      {body}
    </DashboardSection>
  );
}
