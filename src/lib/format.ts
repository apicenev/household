import { tz } from "@date-fns/tz";
import { addDays, differenceInCalendarDays, format, getDay } from "date-fns";
import { de } from "date-fns/locale";

/**
 * de-CH formatting for dates, times and numbers (UI-10, requirements §5.2).
 * Pure: every function takes an explicit time zone (default Europe/Zurich), and
 * relative formatting takes an injectable `today`.
 */

export const DEFAULT_TIME_ZONE = "Europe/Zurich";

function fmt(date: Date, pattern: string, timeZone: string): string {
  return format(date, pattern, { locale: de, in: tz(timeZone) });
}

/** «Sa., 3. Okt.» */
export function formatDate(date: Date, timeZone = DEFAULT_TIME_ZONE): string {
  // date-fns abbreviates September as «Sep.»; the design uses «Sept.».
  return fmt(date, "EEE, d. MMM", timeZone).replace(/\bSep\./, "Sept.");
}

/** «Mittwoch, 30. September» */
export function formatLongDate(date: Date, timeZone = DEFAULT_TIME_ZONE): string {
  return fmt(date, "EEEE, d. MMMM", timeZone);
}

/** «03.10.2026» */
export function formatNumericDate(date: Date, timeZone = DEFAULT_TIME_ZONE): string {
  return fmt(date, "dd.MM.yyyy", timeZone);
}

/** «Sa.» */
export function formatWeekday(date: Date, timeZone = DEFAULT_TIME_ZONE): string {
  return fmt(date, "EEE", timeZone);
}

/**
 * Calendar days from `today` to `date` in the given time zone
 * (0 = same day, 1 = tomorrow, -1 = yesterday), independent of the time of day and DST.
 */
export function calendarDaysFrom(date: Date, today: Date, timeZone = DEFAULT_TIME_ZONE): number {
  return differenceInCalendarDays(date, today, { in: tz(timeZone) });
}

/**
 * «Heute» / «Morgen» / «Gestern», the weekday («Sa.») for the rest of the coming week,
 * otherwise the date («Sa., 3. Okt.»).
 */
export function relativeDay(
  date: Date,
  today: Date = new Date(),
  timeZone = DEFAULT_TIME_ZONE,
): string {
  const days = calendarDaysFrom(date, today, timeZone);
  if (days === 0) return "Heute";
  if (days === 1) return "Morgen";
  if (days === -1) return "Gestern";
  if (days > 1 && days < 7) return formatWeekday(date, timeZone);
  return formatDate(date, timeZone);
}

/**
 * Due date of a task (TSK-08, Phase 3 B11): «Gestern» / «Heute» / «Morgen», otherwise the date
 * «Sa., 3. Okt.»; «Ohne Datum» without one. Both arguments are date keys («2026-10-03») in the
 * household time zone.
 */
export function dueLabel(dueDate: string | null, todayKey: string, timeZone = DEFAULT_TIME_ZONE) {
  if (dueDate === null) return "Ohne Datum";
  const days = differenceInCalendarDays(fromDateKey(dueDate), fromDateKey(todayKey), {
    in: tz("UTC"),
  });
  if (days === 0) return "Heute";
  if (days === 1) return "Morgen";
  if (days === -1) return "Gestern";
  return formatDate(fromDateKey(dueDate), timeZone);
}

/**
 * When a task was completed («Erledigt» rows, B5): «gerade eben» within the last minute,
 * «Heute», «Gestern», otherwise the date «Mo., 28. Sept.».
 */
export function completedLabel(
  completedAt: Date,
  now: Date = new Date(),
  timeZone = DEFAULT_TIME_ZONE,
): string {
  if (now.getTime() - completedAt.getTime() < 60_000) return "gerade eben";
  const days = calendarDaysFrom(completedAt, now, timeZone);
  if (days === 0) return "Heute";
  if (days === -1) return "Gestern";
  return formatDate(completedAt, timeZone);
}

/** Calendar date as «2026-10-03» in the given time zone (the value format of <input type="date">). */
export function toDateKey(date: Date, timeZone = DEFAULT_TIME_ZONE): string {
  return fmt(date, "yyyy-MM-dd", timeZone);
}

/**
 * Date for a «2026-10-03» key at 12:00 UTC, which is the same calendar day in every
 * time zone between UTC−11 and UTC+11 (incl. Europe/Zurich).
 */
export function fromDateKey(key: string): Date {
  return new Date(`${key}T12:00:00Z`);
}

/** «10:00» (24-hour) */
export function formatTime(date: Date, timeZone = DEFAULT_TIME_ZONE): string {
  return fmt(date, "HH:mm", timeZone);
}

/** «10:00–12:00» (en dash, no spaces) */
export function formatTimeRange(start: Date, end: Date, timeZone = DEFAULT_TIME_ZONE): string {
  return `${formatTime(start, timeZone)}–${formatTime(end, timeZone)}`;
}

/**
 * «1'250.50». Without `fractionDigits`, up to two decimals are shown as needed.
 * Intl uses the typographic apostrophe (’) for de-CH; the app uses the plain one (').
 */
export function formatNumber(value: number, fractionDigits?: number): string {
  const formatter = new Intl.NumberFormat("de-CH", {
    minimumFractionDigits: fractionDigits ?? 0,
    maximumFractionDigits: fractionDigits ?? 2,
  });
  return formatter.format(value).replace(/’/g, "'");
}

/**
 * Quick picks for date fields: «Heute», «Morgen» and the next Saturday at least two days
 * ahead («Sa.»), as date keys.
 */
export function quickPickDates(today: Date, timeZone = DEFAULT_TIME_ZONE) {
  const todayKey = toDateKey(today, timeZone);
  const base = fromDateKey(todayKey);
  const weekday = getDay(base, { in: tz("UTC") }); // 0 = Sunday … 6 = Saturday
  let untilSaturday = (6 - weekday + 7) % 7;
  if (untilSaturday < 2) untilSaturday += 7;
  const saturday = addDays(base, untilSaturday);

  return [
    { label: "Heute", key: todayKey, ariaLabel: `Heute, ${formatDate(base, timeZone)}` },
    {
      label: "Morgen",
      key: toDateKey(addDays(base, 1), "UTC"),
      ariaLabel: `Morgen, ${formatDate(addDays(base, 1), timeZone)}`,
    },
    {
      label: formatWeekday(saturday, timeZone),
      key: toDateKey(saturday, "UTC"),
      ariaLabel: formatDate(saturday, timeZone),
    },
  ];
}
