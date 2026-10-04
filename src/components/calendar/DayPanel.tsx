import { CalendarIcon } from "@heroicons/react/24/outline";
import type { ReactNode } from "react";
import { calendarCopy, loadingLabels } from "../../lib/copy";
import { cx } from "../../lib/cx";
import type { EventOccurrence } from "../../types";
import { Skeleton } from "../ui/Skeleton";
import { selectedDayTitle } from "./calendarLabels";

/** «Nichts geplant» card (`Calendar.dc.html`); the «Termin hinzufügen» action is slice C. */
export function NothingPlanned({
  text,
  action,
  desktop,
}: {
  text?: string;
  action?: ReactNode;
  desktop: boolean;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center gap-2 rounded-card bg-surface px-5 text-center shadow-card",
        desktop ? "py-7" : "py-6",
      )}
    >
      <CalendarIcon aria-hidden="true" className="size-7 text-ink-subtle" />
      <span className="text-body font-semibold">{calendarCopy.nothingPlanned}</span>
      {text && <span className="text-body-sm text-ink-muted">{text}</span>}
      {action}
    </div>
  );
}

/** Two pulsing cards while the events load (D49). */
export function DaySkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={loadingLabels.loading}
      className="flex animate-skeleton flex-col gap-2"
    >
      {[0, 1].map((index) => (
        <div key={index} className="flex gap-3.5 rounded-card bg-surface px-4 py-3.5 shadow-card">
          <Skeleton className="h-4 w-11" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className={cx("h-4", index === 0 ? "w-3/5" : "w-2/5")} />
            <Skeleton className="h-5 w-20 rounded-pill" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The selected day (CAL-02): header «Heute · Mi., 30. Sept.» with «2 Termine», then its
 * cards or «Nichts geplant». Below the grid on phones; the 300 px right column on desktop
 * (`aria-label` «Ausgewählter Tag»).
 */
export function DayPanel({
  dayKey,
  todayKey,
  occurrences,
  loading,
  desktop,
  emptyAction,
  renderCard,
}: {
  dayKey: string;
  todayKey: string;
  occurrences: readonly EventOccurrence[];
  loading: boolean;
  desktop: boolean;
  emptyAction?: ReactNode;
  renderCard: (occurrence: EventOccurrence) => ReactNode;
}) {
  const Wrapper = desktop ? "aside" : "section";
  return (
    <Wrapper
      aria-label={desktop ? calendarCopy.selectedDay : undefined}
      className={cx("flex flex-col", desktop ? "gap-3" : "gap-2")}
    >
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2
          className={cx(
            "tabular-nums",
            desktop ? "font-display text-[24px] leading-8 font-medium" : "text-heading",
          )}
        >
          {selectedDayTitle(dayKey, todayKey)}
        </h2>
        {!loading && occurrences.length > 0 && (
          <span className="shrink-0 text-body-sm text-ink-muted">
            {calendarCopy.eventCount(occurrences.length)}
          </span>
        )}
      </div>
      {loading ? (
        <DaySkeleton />
      ) : occurrences.length === 0 ? (
        <NothingPlanned desktop={desktop} action={emptyAction} />
      ) : (
        occurrences.map((occurrence) => renderCard(occurrence))
      )}
    </Wrapper>
  );
}
