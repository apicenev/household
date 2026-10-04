import { TZDate } from "@date-fns/tz";
import { formatTime, toDateKey } from "../lib/format";
import { addDaysToKey, daysBetweenKeys, keyParts } from "./dateKeys";

/**
 * Event times (Phase 6 B2, B3, B6): the one place that converts between stored values,
 * calendar date keys («2026-10-03») and local clock times («19:30») of the household zone.
 *
 * - **Timed** events store real instants; they are shown and edited in the household zone.
 * - **All-day** events store floating dates at 00:00 **UTC**: `start` = first day, `end` =
 *   last day (inclusive). Read them only through `allDayKeys`; formatting a stored all-day
 *   `Date` in a zone west of UTC would show the day before.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** At most 366 calendar days per event (B3), as a cap against runaway rendering. */
export const MAX_EVENT_DAYS = 366;

export const EVENT_TITLE_MAX = 200;
export const EVENT_DESCRIPTION_MAX = 2000;

/** Most participants a member list may hold (rules: 1–20). */
export const MAX_PARTICIPANTS = 20;

/** The stored `start` / `end` of an all-day event from its first and last day. */
export function allDayToStored(startKey: string, endKey: string): { start: Date; end: Date } {
  return { start: keyToUtcMidnight(startKey), end: keyToUtcMidnight(endKey) };
}

/** First and last day (inclusive) of an all-day event. */
export function allDayKeys(event: { start: Date; end: Date }): {
  startKey: string;
  endKey: string;
} {
  return { startKey: utcKey(event.start), endKey: utcKey(event.end) };
}

function keyToUtcMidnight(key: string): Date {
  const { year, month, day } = keyParts(key);
  return new Date(Date.UTC(year, month - 1, day));
}

function utcKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The instant of a local date and clock time («2026-10-02», «19:30») in `timeZone`. A time
 * the clock skips (DST spring gap, 02:30 on 29 Mar in Zurich) moves forward to the matching
 * later time (03:30); a time that occurs twice (autumn) takes the first one.
 */
export function zonedToInstant(dateKey: string, time: string, timeZone: string): Date {
  const { year, month, day } = keyParts(dateKey);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(new TZDate(year, month - 1, day, hours, minutes, timeZone).getTime());
}

/** Local date and clock time of an instant in `timeZone`. */
export function instantToZoned(date: Date, timeZone: string): { dateKey: string; time: string } {
  return { dateKey: toDateKey(date, timeZone), time: formatTime(date, timeZone) };
}

/** `[start, end)` of a local day; 23 or 25 hours long on DST days. */
export function dayBounds(dateKey: string, timeZone: string): { start: Date; end: Date } {
  return {
    start: zonedToInstant(dateKey, "00:00", timeZone),
    end: zonedToInstant(addDaysToKey(dateKey, 1), "00:00", timeZone),
  };
}

export interface EventTimes {
  startKey: string;
  startTime: string;
  endKey: string;
  endTime: string;
}

/**
 * Defaults of a new timed event on `dayKey` (B6): today → the next full hour after now
 * (14:10 and 14:00 → 15:00), from 23:00 on → tomorrow 09:00; any other day → 09:00. The end
 * is one hour later.
 */
export function defaultTimes(dayKey: string, now: Date, timeZone: string): EventTimes {
  const today = instantToZoned(now, timeZone);
  let start: Date;
  if (dayKey !== today.dateKey) {
    start = zonedToInstant(dayKey, "09:00", timeZone);
  } else {
    const nextHour = Number(today.time.slice(0, 2)) + 1;
    start =
      nextHour >= 24
        ? zonedToInstant(addDaysToKey(dayKey, 1), "09:00", timeZone)
        : zonedToInstant(dayKey, `${String(nextHour).padStart(2, "0")}:00`, timeZone);
  }
  const startLocal = instantToZoned(start, timeZone);
  const endLocal = instantToZoned(new Date(start.getTime() + 60 * 60 * 1000), timeZone);
  return {
    startKey: startLocal.dateKey,
    startTime: startLocal.time,
    endKey: endLocal.dateKey,
    endTime: endLocal.time,
  };
}

/**
 * The end of a timed event whose start moves, keeping the duration (B6: only used when the
 * start moves past the end).
 */
export function moveEndWithStart(oldStart: Date, oldEnd: Date, newStart: Date): Date {
  return new Date(newStart.getTime() + (oldEnd.getTime() - oldStart.getTime()));
}

/**
 * The last day of an all-day event whose first day moves, keeping the length (B6: only used
 * when the first day moves past the last).
 */
export function moveEndKeyWithStart(
  oldStartKey: string,
  oldEndKey: string,
  newStartKey: string,
): string {
  return addDaysToKey(newStartKey, daysBetweenKeys(oldStartKey, oldEndKey));
}

export type EventTimesError = "endBeforeStart" | "tooLong" | "notMidnight";

/**
 * Validity of stored times (CAL-05, B3), mirrored by firestore.rules: the end may equal the
 * start; at most 366 calendar days, which is `end − start <= 366 days` for timed events and
 * `<= 365 days` for all-day ones (their end is the last day itself).
 */
export function validateEventTimes(input: {
  allDay: boolean;
  start: Date;
  end: Date;
}): EventTimesError | null {
  const { allDay, start, end } = input;
  if (allDay && (start.getTime() % DAY_MS !== 0 || end.getTime() % DAY_MS !== 0)) {
    return "notMidnight";
  }
  const length = end.getTime() - start.getTime();
  if (length < 0) return "endBeforeStart";
  const maxDays = allDay ? MAX_EVENT_DAYS - 1 : MAX_EVENT_DAYS;
  return length > maxDays * DAY_MS ? "tooLong" : null;
}
