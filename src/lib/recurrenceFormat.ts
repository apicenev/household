import { addDaysToKey, daysBetweenKeys, endOfWeekKey, weekdayOfKey } from "../domain/dateKeys";
import { rotationOrder } from "../domain/rotation";
import type { RecurrenceRule, TaskRotation, WeekStart } from "../types";
import { DEFAULT_TIME_ZONE, formatDate, fromDateKey } from "./format";

/**
 * German labels for recurrence and rotation (Phase 4 B10, D28, D29). Weekdays use the JS
 * convention 0 = Sunday … 6 = Saturday.
 */

export const WEEKDAY_NAMES = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
] as const;

export const WEEKDAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;

const MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
] as const;

/** Weekdays 0–6 in display order for the household week start (D32). */
export function weekdaysInOrder(weekStartsOn: WeekStart): number[] {
  return Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);
}

function weekdayList(days: readonly number[], weekStartsOn: WeekStart): string {
  return weekdaysInOrder(weekStartsOn)
    .filter((day) => days.includes(day))
    .map((day) => WEEKDAY_NAMES[day])
    .join(", ");
}

/**
 * The rule in words (B10). `short` for task rows («Wöchentlich», «Alle 2 Wochen»), otherwise
 * the full text of the picker summary and the detail panel («Jeden Samstag», «Alle 2 Wochen ·
 * Sonntag», «Monatlich am 3.»).
 */
export function describeRule(
  rule: RecurrenceRule,
  { short = false, weekStartsOn = 1 }: { short?: boolean; weekStartsOn?: WeekStart } = {},
): string {
  switch (rule.freq) {
    case "daily":
      return rule.interval === 1 ? "Täglich" : `Alle ${rule.interval} Tage`;
    case "weekly": {
      const days = rule.byWeekday ?? [];
      if (rule.interval === 1) {
        if (short) return "Wöchentlich";
        return days.length === 1
          ? `Jeden ${WEEKDAY_NAMES[days[0]]}`
          : `Wöchentlich am ${weekdayList(days, weekStartsOn)}`;
      }
      const every = `Alle ${rule.interval} Wochen`;
      return short ? every : `${every} · ${weekdayList(days, weekStartsOn)}`;
    }
    case "monthly":
      return short ? "Monatlich" : `Monatlich am ${rule.byMonthDay}.`;
    case "yearly":
      return short
        ? "Jährlich"
        : `Jährlich am ${rule.byMonthDay}. ${MONTH_NAMES[(rule.byMonth ?? 1) - 1]}`;
  }
}

/** «Nevio → Anna», starting with the current assignee; former members are left out. */
export function rotationLabel(
  rotation: TaskRotation,
  nameOf: (uid: string) => string | undefined,
): string {
  return rotationOrder(rotation)
    .map(nameOf)
    .filter((name): name is string => name !== undefined)
    .join(" → ");
}

/**
 * When the next occurrence is due, inside a sentence (D29): «heute», «morgen», otherwise
 * «am Di., 13. Okt.».
 */
export function nextDuePhrase(
  dueDate: string,
  today: string,
  timeZone = DEFAULT_TIME_ZONE,
): string {
  const days = daysBetweenKeys(today, dueDate);
  if (days === 0) return "heute";
  if (days === 1) return "morgen";
  return `am ${formatDate(fromDateKey(dueDate), timeZone)}`;
}

/**
 * Note after «… erledigt» for a recurring task (D29): the next assignee with rotation,
 * otherwise the next due date.
 */
export function completionNote(
  next: { dueDate: string; assigneeName?: string; rotates: boolean },
  today: string,
  timeZone = DEFAULT_TIME_ZONE,
): string {
  if (next.rotates && next.assigneeName) return `als Nächstes ist ${next.assigneeName} dran`;
  return `nächstes Mal ${nextDuePhrase(next.dueDate, today, timeZone)}`;
}

/**
 * Rotation preview of the detail panel (D28): «Diesen Samstag Nevio, danach Anna am Sa.,
 * 10. Okt.»; «Heute» / «Morgen» for those days, «Diesmal» for overdue or later weeks.
 */
export function rotationPreview(
  current: { dueDate: string; name: string },
  next: { dueDate: string; name: string },
  today: string,
  weekStartsOn: WeekStart,
  timeZone = DEFAULT_TIME_ZONE,
): string {
  let lead = "Diesmal";
  if (current.dueDate === today) lead = "Heute";
  else if (current.dueDate === addDaysToKey(today, 1)) lead = "Morgen";
  else if (current.dueDate > today && current.dueDate <= endOfWeekKey(today, weekStartsOn)) {
    lead = `Diesen ${WEEKDAY_NAMES[weekdayOfKey(current.dueDate)]}`;
  }
  return `${lead} ${current.name}, danach ${next.name} ${nextDuePhrase(next.dueDate, today, timeZone)}`;
}

/**
 * The rule inside a sentence (series delete dialog): «jeden Samstag», «alle 4 Tage», «alle
 * 2 Wochen am Sonntag».
 */
export function describeRuleInSentence(rule: RecurrenceRule, weekStartsOn: WeekStart = 1): string {
  const text = describeRule(rule, { weekStartsOn }).replace(" · ", " am ");
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** «Samstage» for a weekly rule on a single day (the «Ganze Serie» hint), otherwise undefined. */
export function weekdayPlural(rule: RecurrenceRule): string | undefined {
  if (rule.freq !== "weekly" || rule.byWeekday?.length !== 1) return undefined;
  return `${WEEKDAY_NAMES[rule.byWeekday[0]]}e`;
}
