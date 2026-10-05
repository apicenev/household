import type { WeekStart } from "../types";

/**
 * Arithmetic on calendar date keys («2026-10-03», NFR-09). Everything runs in UTC, so a key
 * is a plain calendar date and DST can't shift it.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function keyToUtc(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function utcToKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** «2026-10-03» for year, month (1–12) and day. */
export function dateKey(year: number, month: number, day: number): string {
  return utcToKey(Date.UTC(year, month - 1, day));
}

/** Year, month (1–12) and day of a key. */
export function keyParts(key: string): { year: number; month: number; day: number } {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

export function addDaysToKey(key: string, days: number): string {
  return utcToKey(keyToUtc(key) + days * DAY_MS);
}

/** Calendar days from date key `a` to date key `b` (b − a). */
export function daysBetweenKeys(a: string, b: string): number {
  return Math.round((keyToUtc(b) - keyToUtc(a)) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOfKey(key: string): number {
  return new Date(keyToUtc(key)).getUTCDay();
}

/** First day of the week containing `key` (HH-07 week start). */
export function startOfWeekKey(key: string, weekStartsOn: WeekStart): string {
  return addDaysToKey(key, -((weekdayOfKey(key) - weekStartsOn + 7) % 7));
}

/** Last day of the week containing `key`. */
export function endOfWeekKey(key: string, weekStartsOn: WeekStart): string {
  return addDaysToKey(startOfWeekKey(key, weekStartsOn), 6);
}

/** Days in a month (1–12), leap years included. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Whether `value` is a real calendar date written as «2026-10-03». */
export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_KEY.test(value)) return false;
  const { year, month, day } = keyParts(value);
  return dateKey(year, month, day) === value;
}
