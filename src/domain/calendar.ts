import { toDateKey } from "../lib/format";
import type {
  CalendarEvent,
  EventCategory,
  EventOccurrence,
  EventParticipants,
  Member,
  WeekStart,
} from "../types";
import {
  addDaysToKey,
  daysBetweenKeys,
  daysInMonth,
  endOfWeekKey,
  isDateKey,
  keyParts,
  dateKey as makeDateKey,
  startOfWeekKey,
} from "./dateKeys";
import { allDayKeys, allDayToStored, dayBounds, instantToZoned, zonedToInstant } from "./eventTime";
import { MAX_OCCURRENCES, occurrenceDates, seriesRange } from "./recurrence";

/**
 * Calendar rules (Phase 6): month grid, which events touch which day, the multi-day bar,
 * «Demnächst» and the URL parameters; recurring events are expanded here (Phase 7). Pure
 * functions; all-day events are compared by date keys, timed events by instants in the
 * household zone (Phase 6 B2).
 */

/** Days «Demnächst» looks ahead, today included (B9). */
export const UPCOMING_DAYS = 60;

/** Dots per mobile day cell (B7). */
export const MAX_DAY_DOTS = 3;

export type CalendarView = "month" | "upcoming";

export interface CalendarDay {
  key: string;
  /** Day of the month, 1–31. */
  day: number;
  /** False for the greyed leading / trailing days of other months. */
  inMonth: boolean;
  isToday: boolean;
}

/** «2026-10» of a date key. */
export function monthOfKey(key: string): string {
  return key.slice(0, 7);
}

/** `month` («2026-10») shifted by `delta` months. */
export function addMonths(month: string, delta: number): string {
  const { year, month: m } = keyParts(`${month}-01`);
  const index = year * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/**
 * The weeks of a month (CAL-01, B7): only as many as needed (4–6), each 7 days from the
 * household's week start, with the neighbouring months' days marked.
 */
export function monthGrid(month: string, weekStartsOn: WeekStart, todayKey: string) {
  const { year, month: m } = keyParts(`${month}-01`);
  const first = makeDateKey(year, m, 1);
  const last = makeDateKey(year, m, daysInMonth(year, m));
  const gridEnd = endOfWeekKey(last, weekStartsOn);
  const weeks: CalendarDay[][] = [];
  for (let key = startOfWeekKey(first, weekStartsOn); key <= gridEnd;) {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i += 1, key = addDaysToKey(key, 1)) {
      week.push({
        key,
        day: keyParts(key).day,
        inMonth: monthOfKey(key) === month,
        isToday: key === todayKey,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

const MONTH_PARAM = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DAY_PARAM = /^\d{4}-\d{2}-\d{2}$/;

/** `?month=2026-10` (B8); missing or invalid → the month of today. */
export function parseMonthParam(value: string | null, todayKey: string): string {
  return value && MONTH_PARAM.test(value) ? value : monthOfKey(todayKey);
}

/** `?day=2026-10-14` (B8): a real calendar date, otherwise `null`. */
export function parseDayParam(value: string | null): string | null {
  if (!value || !DAY_PARAM.test(value)) return null;
  const { year, month, day } = keyParts(value);
  return makeDateKey(year, month, day) === value ? value : null;
}

/** `?view=upcoming` (B8); anything else is the month view. */
export function parseViewParam(value: string | null): CalendarView {
  return value === "upcoming" ? "upcoming" : "month";
}

/**
 * First and last local day an occurrence touches (B4). All-day: its stored dates. Timed: the
 * days of its start and of its last instant, so an event ending exactly at 00:00 doesn't
 * reach the next day; a zero-length event belongs to its start day.
 */
export function occurrenceDays(
  occurrence: Pick<EventOccurrence, "event" | "start" | "end">,
  timeZone: string,
): { startKey: string; endKey: string } {
  if (occurrence.event.allDay) return allDayKeys(occurrence);
  const startKey = toDateKey(occurrence.start, timeZone);
  if (occurrence.end.getTime() <= occurrence.start.getTime()) return { startKey, endKey: startKey };
  return { startKey, endKey: toDateKey(new Date(occurrence.end.getTime() - 1), timeZone) };
}

/** Later than any date the calendar shows: «no upper bound» for an expansion. */
const FAR_FUTURE = "9999-12-31";

/** «{eventId}@{date}»: the key and URL value of one occurrence of a series (Phase 7 B6, B9). */
export function occurrenceKey(eventId: string, date: string): string {
  return `${eventId}@${date}`;
}

/**
 * First day of an event as stored, which is the anchor (and first occurrence) of a series
 * (Phase 7 B3): the household-zone day of a timed start, the key of an all-day one.
 */
export function eventStartKey(event: CalendarEvent, timeZone: string): string {
  return occurrenceDays({ event, start: event.start, end: event.end }, timeZone).startKey;
}

/** The only occurrence of a one-off event (and the first of a series as stored). */
export function singleOccurrence(event: CalendarEvent, timeZone: string): EventOccurrence {
  return {
    key: event.id,
    event,
    date: eventStartKey(event, timeZone),
    start: event.start,
    end: event.end,
  };
}

/**
 * Start and end of a series' occurrence on `dateKey` (Phase 7 B4). All-day: the same number of
 * days from that date. Timed: the start's **and** the end's clock time in the household zone
 * (the end `dayOffset` local days later), so «10:00–12:00» stays that across DST; a time in
 * the spring gap moves forward, an end that would fall before the start is the start.
 */
export function occurrenceTimes(
  event: CalendarEvent,
  dateKey: string,
  timeZone: string,
): { start: Date; end: Date } {
  if (event.allDay) {
    const { startKey, endKey } = allDayKeys(event);
    return allDayToStored(dateKey, addDaysToKey(dateKey, daysBetweenKeys(startKey, endKey)));
  }
  const from = instantToZoned(event.start, timeZone);
  if (dateKey === from.dateKey) return { start: event.start, end: event.end };
  const to = instantToZoned(event.end, timeZone);
  const start = zonedToInstant(dateKey, from.time, timeZone);
  const endKey = addDaysToKey(dateKey, daysBetweenKeys(from.dateKey, to.dateKey));
  const end = zonedToInstant(endKey, to.time, timeZone);
  return { start, end: end.getTime() < start.getTime() ? start : end };
}

/** The occurrence of a series on `dateKey` (which must be on its schedule). */
export function seriesOccurrence(
  event: CalendarEvent,
  dateKey: string,
  timeZone: string,
): EventOccurrence {
  return {
    key: occurrenceKey(event.id, dateKey),
    event,
    date: dateKey,
    ...occurrenceTimes(event, dateKey, timeZone),
  };
}

/**
 * Every appearance of the events within the days `firstKey` … `lastKey` (inclusive, household
 * zone; Phase 6 B11). A one-off event appears once if it touches the range; a recurring one
 * once per occurrence touching it (REV-03, Phase 7 B6), at most `MAX_OCCURRENCES` per event.
 * Occurrences that start before the range but reach into it (multi-day series, B7) count.
 */
export function occurrencesInRange(
  events: readonly CalendarEvent[],
  firstKey: string,
  lastKey: string,
  timeZone: string,
  weekStartsOn: WeekStart,
): EventOccurrence[] {
  const result: EventOccurrence[] = [];
  const touches = (occurrence: EventOccurrence) => {
    const { startKey, endKey } = occurrenceDays(occurrence, timeZone);
    return endKey >= firstKey && startKey <= lastKey;
  };
  for (const event of events) {
    const first = singleOccurrence(event, timeZone);
    if (!event.recurrence) {
      if (touches(first)) result.push(first);
      continue;
    }
    const span = daysBetweenKeys(first.date, occurrenceDays(first, timeZone).endKey);
    const dates = occurrenceDates(
      event.recurrence,
      first.date,
      addDaysToKey(firstKey, -span),
      lastKey,
      weekStartsOn,
    );
    if (dates.length === MAX_OCCURRENCES && import.meta.env?.DEV) {
      console.warn(`Event ${event.id}: expansion capped at ${MAX_OCCURRENCES} occurrences`);
    }
    for (const date of dates) {
      const occurrence = seriesOccurrence(event, date, timeZone);
      if (touches(occurrence)) result.push(occurrence);
    }
  }
  return result;
}

/**
 * First and last occurrence of a series (D63; `last` `null` = never ends), `null` for a
 * one-off event or a series without occurrences.
 */
export function seriesBounds(
  event: CalendarEvent,
  timeZone: string,
  weekStartsOn: WeekStart,
): { first: string; last: string | null } | null {
  if (!event.recurrence) return null;
  return seriesRange(event.recurrence, eventStartKey(event, timeZone), weekStartsOn);
}

/** «Nächste Termine» (D64): up to `count` occurrences of a series after `afterKey`. */
export function nextOccurrences(
  event: CalendarEvent,
  afterKey: string,
  count: number,
  timeZone: string,
  weekStartsOn: WeekStart,
): EventOccurrence[] {
  if (!event.recurrence) return [];
  return occurrenceDates(
    event.recurrence,
    eventStartKey(event, timeZone),
    addDaysToKey(afterKey, 1),
    FAR_FUTURE,
    weekStartsOn,
    count,
  ).map((date) => seriesOccurrence(event, date, timeZone));
}

function shareParticipants(a: EventParticipants, b: EventParticipants): boolean {
  if (a === "household" || b === "household") return true;
  return a.some((uid) => b.includes(uid));
}

/**
 * «Während Ferien» (D65): the occurrence's first day lies inside another all-day `travel`
 * event of ≥ 2 days that shares at least one participant («Alle» shares with everyone).
 */
export function duringTrip(
  occurrence: EventOccurrence,
  occurrences: readonly EventOccurrence[],
): boolean {
  return occurrences.some((trip) => {
    if (trip.event.id === occurrence.event.id || trip.event.category !== "travel") return false;
    if (!isMultiDayAllDay(trip)) return false;
    const { startKey, endKey } = allDayKeys(trip);
    return (
      startKey <= occurrence.date &&
      occurrence.date <= endKey &&
      shareParticipants(trip.event.participants, occurrence.event.participants)
    );
  });
}

/**
 * The occurrence behind `?event=` (Phase 7 B9): «{id}@{date}» if that date is on the series'
 * schedule; otherwise (a bare id, or a date the schedule no longer has) the next occurrence
 * from today, or the last one of an ended series. A one-off event ignores the date. `null`
 * for an unknown event.
 */
export function resolveOccurrenceParam(
  param: string,
  events: readonly CalendarEvent[],
  todayKey: string,
  timeZone: string,
  weekStartsOn: WeekStart,
): EventOccurrence | null {
  const [id, date] = param.split("@");
  const event = events.find((candidate) => candidate.id === id);
  if (!event) return null;
  if (!event.recurrence) return singleOccurrence(event, timeZone);
  const rule = event.recurrence;
  const anchor = eventStartKey(event, timeZone);
  if (isDateKey(date) && occurrenceDates(rule, anchor, date, date, weekStartsOn, 1).length > 0) {
    return seriesOccurrence(event, date, timeZone);
  }
  const next = occurrenceDates(rule, anchor, todayKey, FAR_FUTURE, weekStartsOn, 1)[0];
  const fallback = next ?? seriesRange(rule, anchor, weekStartsOn)?.last ?? anchor;
  return seriesOccurrence(event, fallback, timeZone);
}

/** All-day and at least two days long: drawn as a bar (D54) with «Tag n von m». */
export function isMultiDayAllDay(occurrence: Pick<EventOccurrence, "event" | "start" | "end">) {
  if (!occurrence.event.allDay) return false;
  const { startKey, endKey } = allDayKeys(occurrence);
  return endKey > startKey;
}

const collator = new Intl.Collator("de-CH");

/**
 * Order within a day (B4): all-day first (multi-day before single-day, then by start), then
 * timed by start, then end, then title.
 */
export function compareOccurrences(a: EventOccurrence, b: EventOccurrence): number {
  if (a.event.allDay !== b.event.allDay) return a.event.allDay ? -1 : 1;
  if (a.event.allDay) {
    const multi = Number(isMultiDayAllDay(b)) - Number(isMultiDayAllDay(a));
    if (multi !== 0) return multi;
  }
  return (
    a.start.getTime() - b.start.getTime() ||
    a.end.getTime() - b.end.getTime() ||
    collator.compare(a.event.title, b.event.title) ||
    collator.compare(a.key, b.key)
  );
}

/** The occurrences touching `dayKey`, sorted (CAL-02, B4). */
export function eventsOnDay(
  occurrences: readonly EventOccurrence[],
  dayKey: string,
  timeZone: string,
): EventOccurrence[] {
  return occurrences
    .filter((occurrence) => {
      const { startKey, endKey } = occurrenceDays(occurrence, timeZone);
      return startKey <= dayKey && dayKey <= endKey;
    })
    .sort(compareOccurrences);
}

/**
 * Dots of a mobile day cell (B7, D54): up to 3 distinct categories in the order of the day's
 * events. Only the event drawn as the bar is left out (not its whole category), so a second
 * overlapping trip still gets its dot.
 */
export function dayDots(
  dayOccurrences: readonly EventOccurrence[],
  barKey?: string | null,
): EventCategory[] {
  const categories: EventCategory[] = [];
  for (const occurrence of dayOccurrences) {
    if (occurrence.key === barKey) continue;
    const { category } = occurrence.event;
    if (!categories.includes(category)) categories.push(category);
    if (categories.length === MAX_DAY_DOTS) break;
  }
  return categories;
}

export interface BarSegment {
  occurrence: EventOccurrence;
  /** Columns 0–6 of the week the bar covers. */
  startColumn: number;
  endColumn: number;
  /** The event starts / ends within this week (rounded ends; title at the start). */
  startsHere: boolean;
  endsHere: boolean;
}

/**
 * The multi-day bar of one grid week (D54): one lane only. Among the all-day events of ≥ 2
 * days touching the week, the earliest-starting (then longest) one gets it; the others show
 * as dots / pills.
 */
export function barLane(
  week: readonly CalendarDay[],
  occurrences: readonly EventOccurrence[],
): BarSegment | null {
  const first = week[0].key;
  const last = week[week.length - 1].key;
  const candidates = occurrences
    .filter(isMultiDayAllDay)
    .map((occurrence) => ({ occurrence, ...allDayKeys(occurrence) }))
    .filter(({ startKey, endKey }) => endKey >= first && startKey <= last)
    .sort(
      (a, b) =>
        a.startKey.localeCompare(b.startKey) ||
        b.endKey.localeCompare(a.endKey) ||
        a.occurrence.key.localeCompare(b.occurrence.key),
    );
  const bar = candidates[0];
  if (!bar) return null;
  return {
    occurrence: bar.occurrence,
    startColumn: Math.max(0, daysBetweenKeys(first, bar.startKey)),
    endColumn: Math.min(week.length - 1, daysBetweenKeys(first, bar.endKey)),
    startsHere: bar.startKey >= first,
    endsHere: bar.endKey <= last,
  };
}

/**
 * «Tag 3 von 8» (D54): only for all-day events of ≥ 2 days; `null` otherwise (timed events
 * crossing midnight get the D55 labels instead).
 */
export function spanInfo(
  occurrence: EventOccurrence,
  dayKey: string,
): { day: number; of: number } | null {
  if (!isMultiDayAllDay(occurrence)) return null;
  const { startKey, endKey } = allDayKeys(occurrence);
  return { day: daysBetweenKeys(startKey, dayKey) + 1, of: daysBetweenKeys(startKey, endKey) + 1 };
}

/** Number of days an all-day event covers («8 Tage»). */
export function allDayLength(occurrence: Pick<EventOccurrence, "start" | "end">): number {
  const { startKey, endKey } = allDayKeys(occurrence);
  return daysBetweenKeys(startKey, endKey) + 1;
}

/**
 * What the time column shows for an occurrence on `dayKey` (D55): «Ganztägig», a time range,
 * or for timed events crossing midnight the start («22:00» / «bis Sa.»), the end («bis
 * 02:00») or a fully covered day («Ganztägig»).
 */
export type DayTime =
  | { kind: "allDay" }
  | { kind: "timed"; start: Date; end: Date }
  | { kind: "starts"; start: Date; end: Date }
  | { kind: "ends"; end: Date }
  | { kind: "through" };

export function dayTime(occurrence: EventOccurrence, dayKey: string, timeZone: string): DayTime {
  if (occurrence.event.allDay) return { kind: "allDay" };
  const { startKey, endKey } = occurrenceDays(occurrence, timeZone);
  const { start, end } = occurrence;
  if (startKey === endKey) return { kind: "timed", start, end };
  if (dayKey === startKey) return { kind: "starts", start, end };
  if (dayKey === endKey) return { kind: "ends", end };
  return { kind: "through" };
}

export interface UpcomingGroup {
  dayKey: string;
  occurrences: EventOccurrence[];
}

/**
 * «Demnächst» (CAL-03, B9): what isn't over yet and starts within the next `days` days,
 * grouped by day. Timed events compare instants (`end >= now`); all-day events compare keys
 * (`endKey >= today`), since their stored end is 00:00 UTC of the last day. A running
 * multi-day event appears once, under today; others once, on their first day.
 */
export function upcoming(
  occurrences: readonly EventOccurrence[],
  now: Date,
  timeZone: string,
  days = UPCOMING_DAYS,
): UpcomingGroup[] {
  const todayKey = toDateKey(now, timeZone);
  const lastKey = addDaysToKey(todayKey, days - 1);
  const limit = dayBounds(addDaysToKey(todayKey, days), timeZone).start;
  const groups = new Map<string, EventOccurrence[]>();
  for (const occurrence of occurrences) {
    let firstKey: string;
    if (occurrence.event.allDay) {
      const { startKey, endKey } = allDayKeys(occurrence);
      if (endKey < todayKey || startKey > lastKey) continue;
      firstKey = startKey;
    } else {
      if (occurrence.end.getTime() < now.getTime()) continue;
      if (occurrence.start.getTime() >= limit.getTime()) continue;
      firstKey = toDateKey(occurrence.start, timeZone);
    }
    const key = firstKey < todayKey ? todayKey : firstKey;
    groups.set(key, [...(groups.get(key) ?? []), occurrence]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayKey, list]) => ({ dayKey, occurrences: list.sort(compareOccurrences) }));
}

/**
 * Who an event shows (B5): «Alle» = every current member; a uid list = those members who are
 * still in the household (former members are left out).
 */
export function visibleParticipants(
  participants: EventParticipants,
  members: readonly Member[],
): { everyone: boolean; members: Member[] } {
  if (participants === "household") return { everyone: true, members: [...members] };
  return {
    everyone: false,
    members: members.filter((member) => participants.includes(member.uid)),
  };
}

/**
 * What gets saved (B5, D58): former members are dropped; nobody left, or every current
 * member picked, means «Alle» (`"household"`, which also covers members who join later).
 */
export function normalizeParticipants(
  participants: EventParticipants,
  members: readonly Member[],
): EventParticipants {
  if (participants === "household") return "household";
  const current = new Set(members.map((member) => member.uid));
  const kept = [...new Set(participants)].filter((uid) => current.has(uid));
  if (kept.length === 0 || kept.length === current.size) return "household";
  return kept;
}
