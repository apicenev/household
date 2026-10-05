import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ActivityEmpty,
  ActivityFilters,
  ActivityRowView,
} from "../components/activity/ActivityParts";
import {
  activityDayHeading,
  activityLine,
  activitySubLine,
  activityTime,
} from "../components/activity/activityLabels";
import { useActivityFeed } from "../components/activity/useActivityFeed";
import { Button } from "../components/ui/Button";
import { InlineAlert } from "../components/ui/InlineAlert";
import { SkeletonList } from "../components/ui/Skeleton";
import {
  activityFilterToParams,
  activitySubject,
  groupByDay,
  groupPurchases,
  parseActivityFilter,
  type ActivityFilter,
} from "../domain/activity";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { useToday } from "../hooks/useToday";
import { actions, activityCopy, areas, loadingLabels } from "../lib/copy";
import { cx } from "../lib/cx";
import { useLoadedHousehold } from "../lib/household/useHousehold";

/**
 * /activity «Aktivität» (`Activity.dc.html`, ACT-03, ACT-04, ACT-08; Phase 8 B1–B3, B12,
 * D77–D82): filter chips (in the URL), the entries newest first grouped by day, «Mehr laden».
 * Live for the latest 50; older pages are read on demand.
 */
export default function ActivityPage() {
  const { household, members, tasks, items, events } = useLoadedHousehold();
  const desktop = useIsDesktop();
  const today = useToday(household.timeZone);
  const [params, setParams] = useSearchParams();
  const filter = parseActivityFilter(params);
  const feed = useActivityFeed(household.id, filter);
  useDocumentTitle(areas.activity);

  function setFilter(next: ActivityFilter) {
    // replace: back leaves the page instead of undoing chip taps (as Aufgaben, Phase 3 B3).
    setParams(activityFilterToParams(next, params), { replace: true });
  }

  const timeZone = household.timeZone;
  const days = useMemo(
    () =>
      groupByDay(
        groupPurchases(
          feed.items.map((item) => item.entry),
          timeZone,
        ),
        timeZone,
      ),
    [feed.items, timeZone],
  );
  const lineContext = { members, householdName: household.name };
  const live = { tasks, items, events };

  let body;
  if (feed.error) {
    body = (
      <InlineAlert tone="danger" action={{ label: actions.retry, onClick: feed.retry }}>
        {activityCopy.loadError}
      </InlineAlert>
    );
  } else if (feed.loading) {
    body = <SkeletonList rows={4} />;
  } else if (days.length === 0) {
    body = <ActivityEmpty />;
  } else {
    body = (
      <div className={cx("flex flex-col", desktop ? "gap-6" : "gap-5")}>
        {days.map((day) => {
          const heading = activityDayHeading(day.dayKey, today);
          const rows = (
            <ul className={cx("rounded-card bg-surface shadow-card", desktop ? "px-5" : "px-4")}>
              {day.rows.map((row, index) => (
                <ActivityRowView
                  key={row.key}
                  row={row}
                  line={activityLine(row, lineContext)}
                  sub={activitySubLine(activitySubject(row, live), members, timeZone)}
                  time={activityTime(row, timeZone)}
                  members={members}
                  desktop={desktop}
                  first={index === 0}
                />
              ))}
            </ul>
          );
          return desktop ? (
            <section
              key={day.dayKey}
              className="grid grid-cols-[140px_minmax(0,1fr)] items-start gap-5"
            >
              <h2 className="flex flex-col gap-0.5 pt-3.5 text-[15px] font-semibold tabular-nums">
                {heading.label}
                {heading.date && (
                  <span className="text-[13px] font-medium text-ink-muted">{heading.date}</span>
                )}
              </h2>
              {rows}
            </section>
          ) : (
            <section key={day.dayKey} className="flex flex-col gap-2">
              <h2 className="flex items-baseline gap-2 px-1 text-[15px] font-semibold tabular-nums">
                {heading.label}
                {heading.date && <span className="font-medium text-ink-muted">{heading.date}</span>}
              </h2>
              {rows}
            </section>
          );
        })}
        {feed.loadMoreError && (
          <InlineAlert tone="danger" action={{ label: actions.retry, onClick: feed.loadMore }}>
            {activityCopy.loadError}
          </InlineAlert>
        )}
        {feed.hasMore && !feed.loadMoreError && (
          <div className="flex justify-center">
            <Button
              variant="secondary"
              size="compact"
              onClick={feed.loadMore}
              loading={feed.loadingMore}
              loadingLabel={loadingLabels.loading}
            >
              {activityCopy.loadMore}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 lg:mx-auto lg:max-w-190">
      {/* Phones show «Aktivität» in the top bar; the page keeps its h1 for screen readers. */}
      <header className="sr-only lg:not-sr-only lg:flex lg:flex-col lg:gap-1">
        <h1 className="font-display text-[40px] leading-[46px] font-medium tracking-[-0.015em] text-ink">
          {areas.activity}
        </h1>
        <p className="text-[15px] text-ink-muted">{activityCopy.subtitle}</p>
      </header>
      <ActivityFilters value={filter} onChange={setFilter} />
      {body}
    </div>
  );
}
