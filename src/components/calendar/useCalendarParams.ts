import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  monthOfKey,
  parseDayParam,
  parseMonthParam,
  parseViewParam,
  type CalendarView,
} from "../../domain/calendar";

/**
 * The calendar's state in the URL (Phase 6 B8): `?month=2026-10&day=2026-10-14&view=upcoming
 * &event={id}`. The day follows the month: a `day` outside the shown month falls back to today
 * (current month) or the 1st. Month, day and tab changes replace the history entry; opening
 * an event on a phone pushes one, so the back gesture closes the detail. On desktop `event`
 * is the expanded card of the selected day (replace, no history entry); moving to another
 * month or day collapses it.
 */
export function useCalendarParams(todayKey: string) {
  const [params, setParams] = useSearchParams();

  const dayParam = parseDayParam(params.get("day"));
  const month = params.get("month")
    ? parseMonthParam(params.get("month"), todayKey)
    : dayParam
      ? monthOfKey(dayParam)
      : monthOfKey(todayKey);
  const selectedDay =
    dayParam && monthOfKey(dayParam) === month
      ? dayParam
      : month === monthOfKey(todayKey)
        ? todayKey
        : `${month}-01`;
  const view: CalendarView = parseViewParam(params.get("view"));
  const eventId = params.get("event");

  const update = useCallback(
    (changes: Record<string, string | null>, push = false) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value === null) next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: !push },
      );
    },
    [setParams],
  );

  /** Shows `nextMonth`; the selected day falls back as above. */
  const showMonth = useCallback(
    (nextMonth: string) => update({ month: nextMonth, day: null, event: null }),
    [update],
  );

  /** Selects a day, switching the month for a greyed day of another month (B7). */
  const selectDay = useCallback(
    (dayKey: string) => update({ month: monthOfKey(dayKey), day: dayKey, event: null }),
    [update],
  );

  /** «Heute»: the current month with today selected. */
  const goToday = useCallback(() => update({ month: null, day: null, event: null }), [update]);

  const setView = useCallback(
    (nextView: CalendarView) => update({ view: nextView === "upcoming" ? "upcoming" : null }),
    [update],
  );

  /** Phones: opens the Termin-Detail (D45) with a history entry. */
  const openEvent = useCallback((id: string) => update({ event: id }, true), [update]);

  /** Desktop: selects an event's day with its card expanded (B8, B9). */
  const showEventDay = useCallback(
    (dayKey: string, id: string) => update({ month: monthOfKey(dayKey), day: dayKey, event: id }),
    [update],
  );

  /** Desktop: expands a card of the selected day, or collapses it with `null`. */
  const expandEvent = useCallback((id: string | null) => update({ event: id }), [update]);

  /** Drops `?event=` without a history entry (unknown or deleted events). */
  const clearEvent = useCallback(() => update({ event: null }), [update]);

  return {
    month,
    selectedDay,
    view,
    eventId,
    showMonth,
    selectDay,
    goToday,
    setView,
    openEvent,
    showEventDay,
    expandEvent,
    clearEvent,
  };
}
