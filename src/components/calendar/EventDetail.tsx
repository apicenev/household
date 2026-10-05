import { ArrowPathIcon, ChevronLeftIcon } from "@heroicons/react/24/outline";
import type { ReactNode } from "react";
import { calendarCopy } from "../../lib/copy";
import { cx } from "../../lib/cx";
import type { EventOccurrence, Member } from "../../types";
import { eventCategories } from "../ui/categories";
import { CategoryLabel } from "../ui/CategoryLabel";
import { Skeleton } from "../ui/Skeleton";
import { dateLine, participantNames, type SeriesDetail } from "./calendarLabels";
import { ParticipantAvatars } from "./ParticipantAvatars";

const travel = eventCategories.travel;
const TravelIcon = travel.icon;

/**
 * Termin-Detail on phones (`Sheets.dc.html` → «Termin-Detail», D45): full screen without the
 * tab bar, back «‹ Kalender», category, title, when, «Für» and «Beschreibung»; the actions
 * come from the page. A series (Phase 7) adds the rule block («Alle 2 Wochen · … » / «Seit …
 * · endet nie», D63) and «Nächste Termine» with «Während Ferien» (D64, D65).
 */
export function EventDetail({
  occurrence,
  series,
  timeZone,
  members,
  onBack,
  headerAction,
  footer,
}: {
  /** `null` while the events are still loading. */
  occurrence: EventOccurrence | null;
  /** The rule block and next dates of a series; `null` / missing for one-off events. */
  series?: SeriesDetail | null;
  timeZone: string;
  members: readonly Member[];
  onBack: () => void;
  headerAction?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-2 flex flex-1 flex-col">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-canvas px-2 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 cursor-pointer items-center gap-0.5 rounded-control pr-2.5 pl-1 text-body font-medium text-brand-strong hovered:bg-brand-soft"
        >
          <ChevronLeftIcon aria-hidden="true" className="size-6" />
          {calendarCopy.back}
        </button>
        {headerAction}
      </header>
      {occurrence ? (
        <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-6">
          <div className="flex flex-col gap-2.5 px-1">
            <CategoryLabel
              kind="event"
              category={occurrence.event.category}
              className="self-start"
            />
            <h1 className="font-display text-display text-ink">{occurrence.event.title}</h1>
            <p className="text-heading tabular-nums">{dateLine(occurrence, timeZone)}</p>
          </div>
          {series && (
            <div className="flex items-start gap-3 rounded-card bg-brand-soft px-4 py-3.5 text-brand-strong">
              <ArrowPathIcon aria-hidden="true" className="size-6 shrink-0" />
              <p className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold tabular-nums">{series.rule}</span>
                {series.since && <span className="text-[13px]">{series.since}</span>}
              </p>
            </div>
          )}
          <dl className="rounded-card bg-surface shadow-card">
            <div className="flex min-h-14 items-center gap-3 px-4">
              <dt className="w-22 shrink-0 text-body-sm text-ink-muted">
                {calendarCopy.participants}
              </dt>
              <dd className="flex min-w-0 items-center gap-3">
                <ParticipantAvatars
                  participants={occurrence.event.participants}
                  members={members}
                  size={30}
                />
                <span aria-hidden="true" className="text-[15px] font-medium">
                  {participantNames(occurrence.event.participants, members)}
                </span>
              </dd>
            </div>
            {occurrence.event.description && (
              <div className="flex gap-3 border-t border-line px-4 py-3.5">
                <dt className="w-22 shrink-0 text-body-sm text-ink-muted">
                  {calendarCopy.description}
                </dt>
                <dd className="text-[15px] leading-5.5 whitespace-pre-line">
                  {occurrence.event.description}
                </dd>
              </div>
            )}
          </dl>
          {series && series.next.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="px-1 text-[15px] font-semibold">{calendarCopy.nextDates}</h2>
              <ul className="overflow-hidden rounded-card bg-surface shadow-card">
                {series.next.map((item, index) => (
                  <li
                    key={item.key}
                    className={cx(
                      "flex min-h-13 items-center gap-2.5 px-4 py-1 tabular-nums",
                      index > 0 && "border-t border-line",
                    )}
                  >
                    <span className="flex-1 text-[15px] font-medium">{item.date}</span>
                    {item.duringTrip && (
                      <span
                        className={cx(
                          "flex h-6 items-center gap-1 rounded-xs pr-2 pl-1.5 text-[12px] font-semibold",
                          travel.pill,
                        )}
                      >
                        <TravelIcon aria-hidden="true" className={cx("size-3.5", travel.main)} />
                        {calendarCopy.duringTrip}
                      </span>
                    )}
                    <span className="text-body-sm text-ink-muted">{item.time}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (
        <div
          role="status"
          aria-busy="true"
          className="flex animate-skeleton flex-col gap-3 px-5 pt-2"
        >
          <Skeleton className="h-7 w-24 rounded-pill" />
          <Skeleton className="h-9 w-3/5" />
          <Skeleton className="h-5 w-2/5" />
        </div>
      )}
      {footer}
    </div>
  );
}
