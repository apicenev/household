import {
  allDayLength,
  dayTime,
  isMultiDayAllDay,
  occurrenceDays,
  spanInfo,
  visibleParticipants,
} from "../../domain/calendar";
import { daysBetweenKeys } from "../../domain/dateKeys";
import { allDayKeys } from "../../domain/eventTime";
import { calendarCopy, terms } from "../../lib/copy";
import {
  formatDate,
  formatDateRange,
  formatDayMonth,
  formatShortRange,
  formatTime,
  formatTimeRange,
  formatWeekday,
  fromDateKey,
} from "../../lib/format";
import type { EventOccurrence, EventParticipants, Member } from "../../types";

/**
 * The calendar's visible text for an occurrence (`Calendar.dc.html`, `Sheets` → Termin-Detail,
 * D54, D55). All-day dates always go through their keys (`fromDateKey`), never through the
 * stored `Date` (B2).
 */

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

const listFormat = new Intl.ListFormat("de-CH", { type: "conjunction" });

/** Weekday of a date key, «Sa.» (no zone involved). */
function weekdayOfKey(key: string): string {
  return formatWeekday(fromDateKey(key), "UTC");
}

/**
 * The time column of a card or row on `dayKey` (D55): «19:30» over «22:30», «Ganztägig», or
 * for timed events crossing midnight «22:00» / «bis Sa.», then «bis 02:00».
 */
export function timeColumn(
  occurrence: EventOccurrence,
  dayKey: string,
  timeZone: string,
): { primary: string; secondary?: string } {
  const time = dayTime(occurrence, dayKey, timeZone);
  switch (time.kind) {
    case "allDay":
    case "through":
      return { primary: terms.allDay };
    case "timed":
      return {
        primary: formatTime(time.start, timeZone),
        secondary: formatTime(time.end, timeZone),
      };
    case "starts":
      return {
        primary: formatTime(time.start, timeZone),
        secondary: calendarCopy.until(weekdayOfKey(occurrenceDays(occurrence, timeZone).endKey)),
      };
    case "ends":
      return { primary: calendarCopy.until(formatTime(time.end, timeZone)) };
  }
}

/** The same on one line («19:30–22:30», «22:00 · bis Sa.»), for the desktop cards and rows. */
export function timeLine(occurrence: EventOccurrence, dayKey: string, timeZone: string): string {
  const time = dayTime(occurrence, dayKey, timeZone);
  if (time.kind === "timed") return formatTimeRange(time.start, time.end, timeZone);
  const { primary, secondary } = timeColumn(occurrence, dayKey, timeZone);
  return calendarCopy.meta(primary, secondary ?? "");
}

/** «Tag 3 von 8» on a day of a multi-day all-day event (D54). */
export function spanLabel(occurrence: EventOccurrence, dayKey: string): string | undefined {
  const span = spanInfo(occurrence, dayKey);
  return span ? calendarCopy.dayOf(span.day, span.of) : undefined;
}

/** «14.–21. Okt. · 8 Tage» for a multi-day all-day event in «Demnächst» (B9). */
export function upcomingSpan(occurrence: EventOccurrence): string | undefined {
  if (!isMultiDayAllDay(occurrence)) return undefined;
  const { startKey, endKey } = allDayKeys(occurrence);
  return calendarCopy.meta(
    formatShortRange(fromDateKey(startKey), fromDateKey(endKey), "UTC"),
    calendarCopy.days(allDayLength(occurrence)),
  );
}

/** «Alle», or the participants' first names («Anna», «Nevio und Anna»). */
export function participantNames(
  participants: EventParticipants,
  members: readonly Member[],
): string {
  const visible = visibleParticipants(participants, members);
  if (visible.everyone) return terms.everyone;
  return listFormat.format(visible.members.map((member) => firstName(member.displayName)));
}

/** «Fr., 2. Okt., 22:00 – Sa., 3. Okt., 02:00» for a timed event over several days (D55). */
function timedRange(occurrence: EventOccurrence, timeZone: string): string {
  const { start, end } = occurrence;
  return `${formatDate(start, timeZone)}, ${formatTime(start, timeZone)} – ${formatDate(end, timeZone)}, ${formatTime(end, timeZone)}`;
}

/**
 * When the event is, for the Termin-Detail («Sa., 3. Okt. · 10:00–12:00», «Do., 1. Okt. ·
 * Ganztägig», «Mi., 14. – Mi., 21. Okt. · 8 Tage»; timed over several days D55).
 */
export function dateLine(occurrence: EventOccurrence, timeZone: string): string {
  const { event, start, end } = occurrence;
  if (event.allDay) {
    const { startKey, endKey } = allDayKeys(occurrence);
    if (startKey === endKey)
      return calendarCopy.meta(formatDate(fromDateKey(startKey), "UTC"), terms.allDay);
    return calendarCopy.meta(
      formatDateRange(fromDateKey(startKey), fromDateKey(endKey), "UTC"),
      calendarCopy.days(daysBetweenKeys(startKey, endKey) + 1),
    );
  }
  const { startKey, endKey } = occurrenceDays(occurrence, timeZone);
  if (startKey !== endKey) return timedRange(occurrence, timeZone);
  return calendarCopy.meta(formatDate(start, timeZone), formatTimeRange(start, end, timeZone));
}

/**
 * The rule line of an expanded card (`Calendar.dc.html`): «Wiederholt sich nicht ·
 * 19:30–22:30» / «… · Ganztägig»; a multi-day all-day event «Mi., 14. – Mi., 21. Okt. ·
 * 8 Tage · Alle»; a timed one over several days its full range (D55).
 */
export function ruleLine(
  occurrence: EventOccurrence,
  timeZone: string,
  members: readonly Member[],
): string {
  const { event, start, end } = occurrence;
  if (isMultiDayAllDay(occurrence)) {
    return calendarCopy.meta(
      dateLine(occurrence, timeZone),
      participantNames(event.participants, members),
    );
  }
  if (event.allDay) return calendarCopy.meta(calendarCopy.noRepeat, terms.allDay);
  const { startKey, endKey } = occurrenceDays(occurrence, timeZone);
  if (startKey !== endKey) return timedRange(occurrence, timeZone);
  return calendarCopy.meta(calendarCopy.noRepeat, formatTimeRange(start, end, timeZone));
}

/** «Heute», «Morgen», «Gestern» for those days, otherwise nothing. */
function relativeName(dayKey: string, todayKey: string): string | undefined {
  const days = daysBetweenKeys(todayKey, dayKey);
  if (days === 0) return terms.today;
  if (days === 1) return terms.tomorrow;
  if (days === -1) return terms.yesterday;
  return undefined;
}

/** Header of the selected day: «Heute · Mi., 30. Sept.» or «Mi., 14. Okt.». */
export function selectedDayTitle(dayKey: string, todayKey: string): string {
  const date = formatDate(fromDateKey(dayKey), "UTC");
  const relative = relativeName(dayKey, todayKey);
  return relative ? calendarCopy.meta(relative, date) : date;
}

/** Day cell label for screen readers: «Sa., 3. Okt., heute, 2 Termine» (D57). */
export function dayCellLabel(dayKey: string, todayKey: string, count: number): string {
  return calendarCopy.cellLabel(formatDate(fromDateKey(dayKey), "UTC"), dayKey === todayKey, count);
}

/** «Demnächst» group header (B9): «Heute» / «Morgen» / «Sa.» next to «3. Okt.». */
export function upcomingHeader(
  dayKey: string,
  todayKey: string,
): { relative: string; date: string; isToday: boolean } {
  const days = daysBetweenKeys(todayKey, dayKey);
  return {
    relative: days === 0 ? terms.today : days === 1 ? terms.tomorrow : weekdayOfKey(dayKey),
    date: formatDayMonth(fromDateKey(dayKey), "UTC"),
    isToday: days === 0,
  };
}
