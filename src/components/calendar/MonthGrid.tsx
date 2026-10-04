import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  addMonths,
  barLane,
  dayDots,
  eventsOnDay,
  monthOfKey,
  type BarSegment,
  type CalendarDay,
} from "../../domain/calendar";
import {
  addDaysToKey,
  dateKey,
  daysInMonth,
  endOfWeekKey,
  keyParts,
  startOfWeekKey,
} from "../../domain/dateKeys";
import { calendarCopy, loadingLabels } from "../../lib/copy";
import { cx } from "../../lib/cx";
import { formatMonthYear } from "../../lib/format";
import type { EventOccurrence, WeekStart } from "../../types";
import { eventCategories } from "../ui/categories";
import { Skeleton } from "../ui/Skeleton";
import { dayCellLabel, timeColumn } from "./calendarLabels";

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/** Pills per desktop cell (B7): 2, or 1 when the cell has a bar. */
const MAX_PILLS = 2;

interface MonthGridProps {
  month: string;
  weeks: CalendarDay[][];
  /** Occurrences of the grid's whole range (leading and trailing days included). */
  occurrences: readonly EventOccurrence[];
  selectedDay: string;
  todayKey: string;
  weekStartsOn: WeekStart;
  timeZone: string;
  desktop: boolean;
  loading: boolean;
  onSelectDay: (dayKey: string) => void;
  onShowMonth: (month: string) => void;
}

/** The same day number in another month, clamped to its length (PageUp / PageDown, D57). */
function sameDayIn(key: string, delta: number): string {
  const target = addMonths(monthOfKey(key), delta);
  const { year, month } = keyParts(`${target}-01`);
  return dateKey(year, month, Math.min(keyParts(key).day, daysInMonth(year, month)));
}

/**
 * The month grid (CAL-01, `Calendar.dc.html`, `Components` → Monatsraster): weekday header in
 * the household's week order, then one row per week. Phones: 50 px cells with the number
 * circle, up to 3 category dots and the multi-day bar behind the numbers. Desktop: bordered
 * cells with the bar lane, pills and «+n weitere» (B7, D54).
 *
 * Keyboard (D57): one tab stop; arrows move by day / week, Home / End to the week's start /
 * end, PageUp / PageDown by month, Enter / Space select. Moving onto a day of another month
 * shows that month.
 */
export function MonthGrid(props: MonthGridProps) {
  const { month, weeks, occurrences, selectedDay, todayKey, timeZone, desktop, loading } = props;
  const [focusKey, setFocusKey] = useState(selectedDay);
  const wantFocus = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const keys = weeks.flat().map((day) => day.key);
  const tabbable = keys.includes(focusKey) ? focusKey : selectedDay;

  // Focus the day the keyboard moved to once it's in the grid: a month change arrives a render
  // later (the router applies it in a transition).
  const focusVisible = keys.includes(focusKey);
  useEffect(() => {
    if (!wantFocus.current || !focusVisible) return;
    wantFocus.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-day="${focusKey}"]`)?.focus();
  }, [focusKey, focusVisible, month]);

  function select(key: string) {
    setFocusKey(key);
    props.onSelectDay(key);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>, key: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select(key);
      return;
    }
    const target =
      event.key === "ArrowLeft"
        ? addDaysToKey(key, -1)
        : event.key === "ArrowRight"
          ? addDaysToKey(key, 1)
          : event.key === "ArrowUp"
            ? addDaysToKey(key, -7)
            : event.key === "ArrowDown"
              ? addDaysToKey(key, 7)
              : event.key === "Home"
                ? startOfWeekKey(key, props.weekStartsOn)
                : event.key === "End"
                  ? endOfWeekKey(key, props.weekStartsOn)
                  : event.key === "PageUp"
                    ? sameDayIn(key, -1)
                    : event.key === "PageDown"
                      ? sameDayIn(key, 1)
                      : null;
    if (target === null) return;
    event.preventDefault();
    wantFocus.current = true;
    setFocusKey(target);
    if (monthOfKey(target) !== month) props.onShowMonth(monthOfKey(target));
  }

  const weekdays = Array.from({ length: 7 }, (_, i) => WEEKDAYS[(i + props.weekStartsOn) % 7]);

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label={formatMonthYear(month)}
      aria-busy={loading || undefined}
      className={cx("flex flex-col", desktop ? "" : "gap-0.5", loading && "animate-skeleton")}
    >
      <div role="row" className={cx("grid grid-cols-7", desktop && "border-b border-line")}>
        {weekdays.map((name) => (
          <span
            key={name}
            role="columnheader"
            className={cx(
              "text-caption font-semibold text-ink-subtle",
              desktop ? "px-3 py-2.5 tracking-[0.03em]" : "pt-1 pb-1.5 text-center",
            )}
          >
            {name}
          </span>
        ))}
      </div>
      {weeks.map((week, row) => {
        const bar = barLane(week, occurrences);
        return (
          <div
            key={week[0].key}
            role="row"
            className={cx(
              "grid grid-cols-7",
              desktop && (weeks.length === 6 ? "h-28" : "h-33.5"),
              desktop && row < weeks.length - 1 && "border-b border-line",
            )}
          >
            {week.map((day, column) => {
              const dayOccurrences = eventsOnDay(occurrences, day.key, timeZone);
              const inBar =
                bar && column >= bar.startColumn && column <= bar.endColumn ? bar : null;
              const cell = {
                day,
                column,
                bar: inBar,
                dayOccurrences,
                selected: day.key === selectedDay,
                tabbable: day.key === tabbable,
                label: dayCellLabel(day.key, todayKey, dayOccurrences.length),
                onClick: () => select(day.key),
                onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => handleKeyDown(event, day.key),
              };
              return desktop ? (
                <DesktopCell
                  key={day.key}
                  {...cell}
                  loading={loading}
                  timeZone={timeZone}
                  lastColumn={column === 6}
                />
              ) : (
                <MobileCell key={day.key} {...cell} loading={loading} />
              );
            })}
          </div>
        );
      })}
      {loading && <span className="sr-only">{loadingLabels.loading}</span>}
    </div>
  );
}

interface CellProps {
  day: CalendarDay;
  column: number;
  bar: BarSegment | null;
  dayOccurrences: EventOccurrence[];
  selected: boolean;
  tabbable: boolean;
  label: string;
  loading: boolean;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

function cellProps(props: CellProps) {
  return {
    role: "gridcell",
    "data-day": props.day.key,
    "aria-label": props.label,
    "aria-selected": props.selected,
    tabIndex: props.tabbable ? 0 : -1,
    onClick: props.onClick,
    onKeyDown: props.onKeyDown,
  } as const;
}

/** Phone cell (50 px): bar behind the 32 px number, dots below. */
function MobileCell(props: CellProps) {
  const { day, column, bar, dayOccurrences, selected, loading } = props;
  const isToday = day.isToday;
  const dots = dayDots(dayOccurrences, bar?.occurrence.key);
  const barStart = bar && bar.startsHere && column === bar.startColumn;
  const barEnd = bar && bar.endsHere && column === bar.endColumn;
  return (
    <div
      {...cellProps(props)}
      className="relative flex h-12.5 cursor-pointer flex-col items-center gap-0.75 rounded-control pt-1 focus-visible:-outline-offset-2"
    >
      {bar && (
        <span
          aria-hidden="true"
          className={cx(
            "absolute top-5.25 h-1.5",
            eventCategories[bar.occurrence.event.category].soft,
            barStart ? "left-1/2" : "left-0",
            barEnd ? "right-1/2" : "right-0",
          )}
        />
      )}
      <span
        aria-hidden="true"
        className={cx(
          "relative flex size-8 items-center justify-center rounded-pill text-[15px] tabular-nums",
          isToday || selected ? "font-bold" : "font-medium",
          isToday
            ? "bg-ink text-canvas"
            : selected
              ? "bg-brand-soft text-brand-strong"
              : day.inMonth
                ? "text-ink"
                : "text-ink-subtle",
          selected && "inset-ring-2 inset-ring-brand",
        )}
      >
        {day.day}
      </span>
      <span aria-hidden="true" className="flex h-1.5 gap-0.75">
        {loading && day.inMonth ? (
          <Skeleton className="size-1.5 rounded-pill" />
        ) : (
          dots.map((category) => (
            <span
              key={category}
              className={cx("size-1.5 rounded-pill", eventCategories[category].dot)}
            />
          ))
        )}
      </span>
    </div>
  );
}

/** Desktop cell: number, bar lane, pills, «+n weitere». */
function DesktopCell(props: CellProps & { timeZone: string; lastColumn: boolean }) {
  const { day, column, bar, dayOccurrences, selected, loading, timeZone, lastColumn } = props;
  const pills = dayOccurrences.filter((occurrence) => occurrence.key !== bar?.occurrence.key);
  const max = bar ? MAX_PILLS - 1 : MAX_PILLS;
  const shown = pills.slice(0, max);
  const barStart = bar && bar.startsHere && column === bar.startColumn;
  const barEnd = bar && bar.endsHere && column === bar.endColumn;
  const barCategory = bar ? eventCategories[bar.occurrence.event.category] : null;
  const BarIcon = barCategory?.icon;
  return (
    <div
      {...cellProps(props)}
      className={cx(
        "flex min-w-0 cursor-pointer flex-col gap-0.75 overflow-hidden px-1.5 pt-1.5 pb-1 transition-colors duration-(--duration-fast) focus-visible:-outline-offset-2",
        !lastColumn && "border-r border-line",
        selected
          ? "bg-brand-soft inset-ring-2 inset-ring-brand"
          : day.inMonth
            ? "bg-surface hovered:bg-sunken"
            : "bg-sunken",
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "flex size-7 shrink-0 items-center justify-center rounded-pill text-[14px] tabular-nums",
          day.isToday || selected ? "font-bold" : "font-medium",
          day.isToday ? "bg-ink text-canvas" : day.inMonth ? "text-ink" : "text-ink-subtle",
        )}
      >
        {day.day}
      </span>
      {bar && barCategory && (
        <span
          aria-hidden="true"
          className={cx(
            "flex h-5.5 shrink-0 items-center gap-1 overflow-hidden px-2 text-caption font-semibold whitespace-nowrap",
            barCategory.pill,
            barStart ? "ml-0 rounded-l-xs" : "-ml-1.75",
            barEnd ? "mr-0 rounded-r-xs" : "-mr-1.75",
          )}
        >
          {(barStart || column === 0) && BarIcon && (
            <>
              <BarIcon className={cx("size-3 shrink-0", barCategory.main)} />
              {bar.occurrence.event.title}
            </>
          )}
        </span>
      )}
      {loading && day.inMonth && <Skeleton className="h-8 rounded-xs" />}
      {shown.map((occurrence) => {
        const style = eventCategories[occurrence.event.category];
        return (
          <span
            key={occurrence.key}
            aria-hidden="true"
            title={occurrence.event.title}
            className={cx(
              "flex min-w-0 flex-col rounded-xs py-0.5 pr-1.5 pl-1.25 leading-3.75",
              style.soft,
            )}
          >
            <span
              className={cx(
                "flex items-center gap-1 text-[11px] font-semibold tabular-nums",
                style.ink,
              )}
            >
              <span className={cx("size-1.5 shrink-0 rounded-pill", style.dot)} />
              {timeColumn(occurrence, day.key, timeZone).primary}
            </span>
            <span className="truncate text-caption font-medium text-ink">
              {occurrence.event.title}
            </span>
          </span>
        );
      })}
      {pills.length > max && (
        <span aria-hidden="true" className="pl-1.5 text-caption font-semibold text-ink-muted">
          {calendarCopy.more(pills.length - max)}
        </span>
      )}
    </div>
  );
}
