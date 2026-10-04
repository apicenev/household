import type { RecurrenceRule, WeekStart } from "../types";
import {
  addDaysToKey,
  dateKey,
  daysBetweenKeys,
  daysInMonth,
  keyParts,
  startOfWeekKey,
  weekdayOfKey,
} from "./dateKeys";

/**
 * Recurrence engine (RTK-01…03, business rule §8.2), shared with recurring events (Phase 7).
 * Pure, on calendar date keys («2026-10-03»), so DST can't move a date.
 *
 * The schedule is anchored at a date (for tasks: the current occurrence's due date, Phase 4
 * B1): «every N days» counts days from the anchor, «every N weeks» counts weeks from the
 * anchor's week (household week start), monthly / yearly count months / years from it.
 */

export const MIN_INTERVAL = 1;
export const MAX_INTERVAL = 52;

/** Safety cap for the day-by-day search (a valid rule always matches far earlier). */
const MAX_STEPS = 1000;

export type RuleProblem = "interval" | "weekdays" | "monthDay" | "month" | "keys";

const allowedKeys: Record<RecurrenceRule["freq"], readonly string[]> = {
  daily: ["freq", "interval"],
  weekly: ["freq", "interval", "byWeekday"],
  monthly: ["freq", "interval", "byMonthDay"],
  yearly: ["freq", "interval", "byMonth", "byMonthDay"],
};

function isIntIn(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

/** Whether a rule is complete and consistent (the same checks as `firestore.rules`). */
export function validateRule(
  rule: RecurrenceRule,
): { ok: true } | { ok: false; problem: RuleProblem } {
  const keys = Object.keys(rule).filter((key) => rule[key as keyof RecurrenceRule] !== undefined);
  if (!keys.every((key) => allowedKeys[rule.freq]?.includes(key))) {
    return { ok: false, problem: "keys" };
  }
  if (!isIntIn(rule.interval, MIN_INTERVAL, MAX_INTERVAL))
    return { ok: false, problem: "interval" };
  switch (rule.freq) {
    case "daily":
      return { ok: true };
    case "weekly": {
      const days = rule.byWeekday ?? [];
      const valid =
        days.length >= 1 &&
        days.every((day) => isIntIn(day, 0, 6)) &&
        new Set(days).size === days.length;
      return valid ? { ok: true } : { ok: false, problem: "weekdays" };
    }
    case "monthly":
    case "yearly":
      // Tasks and the rules support monthly / yearly only with interval 1.
      if (rule.interval !== 1) return { ok: false, problem: "interval" };
      if (!isIntIn(rule.byMonthDay, 1, 31)) return { ok: false, problem: "monthDay" };
      if (rule.freq === "yearly" && !isIntIn(rule.byMonth, 1, 12)) {
        return { ok: false, problem: "month" };
      }
      return { ok: true };
  }
}

/** Day `byMonthDay` of a month, clamped to its last day (31 → 30 Apr / 28 Feb, REV-05). */
function clampedDay(year: number, month: number, byMonthDay: number): string {
  return dateKey(year, month, Math.min(byMonthDay, daysInMonth(year, month)));
}

/**
 * The first date on the schedule strictly after `after`. Dates before the anchor are never
 * returned (the anchor's week / month / year is the first one of the schedule).
 */
export function nextOccurrence(
  rule: RecurrenceRule,
  after: string,
  anchor: string,
  weekStartsOn: WeekStart,
): string {
  switch (rule.freq) {
    case "daily": {
      const elapsed = daysBetweenKeys(anchor, after);
      if (elapsed < 0) return anchor;
      return addDaysToKey(anchor, (Math.floor(elapsed / rule.interval) + 1) * rule.interval);
    }
    case "weekly": {
      const days = new Set(rule.byWeekday ?? []);
      const anchorWeek = startOfWeekKey(anchor, weekStartsOn);
      let candidate = addDaysToKey(after, 1);
      if (candidate < anchorWeek) candidate = anchorWeek;
      for (let step = 0; step < MAX_STEPS; step++) {
        const weeks = daysBetweenKeys(anchorWeek, startOfWeekKey(candidate, weekStartsOn)) / 7;
        if (weeks % rule.interval !== 0) {
          // Jump to the start of the next week on the schedule.
          const skip = rule.interval - (weeks % rule.interval);
          candidate = addDaysToKey(startOfWeekKey(candidate, weekStartsOn), skip * 7);
          continue;
        }
        if (days.has(weekdayOfKey(candidate))) return candidate;
        candidate = addDaysToKey(candidate, 1);
      }
      break;
    }
    case "monthly": {
      const start = keyParts(anchor);
      const from = keyParts(after < anchor ? anchor : after);
      let months = (from.year - start.year) * 12 + (from.month - start.month);
      for (let step = 0; step < MAX_STEPS; step++, months++) {
        if (months < 0 || months % rule.interval !== 0) continue;
        const total = start.month - 1 + months;
        const candidate = clampedDay(
          start.year + Math.floor(total / 12),
          (total % 12) + 1,
          rule.byMonthDay ?? start.day,
        );
        if (candidate > after && candidate >= anchor) return candidate;
      }
      break;
    }
    case "yearly": {
      const start = keyParts(anchor);
      const month = rule.byMonth ?? start.month;
      const day = rule.byMonthDay ?? start.day;
      let year = keyParts(after < anchor ? anchor : after).year;
      for (let step = 0; step < MAX_STEPS; step++, year++) {
        if ((year - start.year) % rule.interval !== 0) continue;
        const candidate = clampedDay(year, month, day);
        if (candidate > after && candidate >= anchor) return candidate;
      }
      break;
    }
  }
  throw new Error(`No occurrence found for rule ${JSON.stringify(rule)}`);
}

/** Whether `key` is on the schedule anchored at `anchor`. */
export function matchesRule(
  rule: RecurrenceRule,
  key: string,
  anchor: string,
  weekStartsOn: WeekStart,
): boolean {
  return nextOccurrence(rule, addDaysToKey(key, -1), anchor, weekStartsOn) === key;
}

/**
 * Due date of the next occurrence (RTK-03, §8.2, Phase 4 B1): the first schedule date strictly
 * after `currentDue` that is also ≥ `today`. A late completion skips the dates that already
 * passed; an early one doesn't shift the schedule.
 */
export function nextDueDate(
  rule: RecurrenceRule,
  currentDue: string,
  today: string,
  weekStartsOn: WeekStart,
): string {
  const yesterday = addDaysToKey(today, -1);
  const after = currentDue > yesterday ? currentDue : yesterday;
  return nextOccurrence(rule, after, currentDue, weekStartsOn);
}

/** First schedule date ≥ `today`, anchored at today (D26: a rule picked without a due date). */
export function firstDueOnOrAfter(
  rule: RecurrenceRule,
  today: string,
  weekStartsOn: WeekStart,
): string {
  return nextOccurrence(rule, addDaysToKey(today, -1), today, weekStartsOn);
}

/** The chips of the RecurrencePicker that tasks offer (Phase 4 B2). */
export type PickerFreq = "none" | "daily" | "weekly" | "nweeks" | "monthly" | "yearly" | "ndays";

export const PICKER_FREQS: readonly PickerFreq[] = [
  "none",
  "daily",
  "weekly",
  "nweeks",
  "monthly",
  "yearly",
  "ndays",
];

/** «Alle N …» starts at 2 (1 is «Täglich» / «Wöchentlich»), as in the design. */
export const MIN_PICKER_N = 2;
export const DEFAULT_PICKER_N = 2;

export interface PickerState {
  freq: PickerFreq;
  /** For «Alle N Wochen» / «Alle N Tage» (2–52). */
  n: number;
  /** For «Wöchentlich» / «Alle N Wochen»; 0 = Sunday … 6 = Saturday. */
  weekdays: number[];
}

/** Picker state for a stored rule (or none); weekdays default to the due date's weekday. */
export function pickerFromRule(
  rule: RecurrenceRule | undefined,
  dueDate: string | null,
): PickerState {
  const defaultDays = dueDate ? [weekdayOfKey(dueDate)] : [];
  if (!rule) return { freq: "none", n: DEFAULT_PICKER_N, weekdays: defaultDays };
  const n = rule.interval >= MIN_PICKER_N ? rule.interval : DEFAULT_PICKER_N;
  switch (rule.freq) {
    case "daily":
      return { freq: rule.interval === 1 ? "daily" : "ndays", n, weekdays: defaultDays };
    case "weekly":
      return {
        freq: rule.interval === 1 ? "weekly" : "nweeks",
        n,
        weekdays: [...(rule.byWeekday ?? defaultDays)].sort((a, b) => a - b),
      };
    case "monthly":
      return { freq: "monthly", n, weekdays: defaultDays };
    case "yearly":
      return { freq: "yearly", n, weekdays: defaultDays };
  }
}

/**
 * The rule a picker state stands for; `null` for «Nie». Monthly / yearly take day and month
 * from `dueDate`; weekly without a selected day uses the due date's weekday.
 */
export function ruleFromPicker(state: PickerState, dueDate: string): RecurrenceRule | null {
  const { month, day } = keyParts(dueDate);
  const weekdays = (state.weekdays.length > 0 ? state.weekdays : [weekdayOfKey(dueDate)])
    .slice()
    .sort((a, b) => a - b);
  const n = Math.min(MAX_INTERVAL, Math.max(MIN_PICKER_N, state.n));
  switch (state.freq) {
    case "none":
      return null;
    case "daily":
      return { freq: "daily", interval: 1 };
    case "ndays":
      return { freq: "daily", interval: n };
    case "weekly":
      return { freq: "weekly", interval: 1, byWeekday: weekdays };
    case "nweeks":
      return { freq: "weekly", interval: n, byWeekday: weekdays };
    case "monthly":
      return { freq: "monthly", interval: 1, byMonthDay: day };
    case "yearly":
      return { freq: "yearly", interval: 1, byMonth: month, byMonthDay: day };
  }
}

/**
 * The rule after the user changed the due date (Phase 4 B6): monthly / yearly follow the new
 * date's day and month, other rules stay. Call it only when the due date changed, so the
 * occurrence clamped to 28 Feb keeps «am 31.».
 */
export function withDueDate(rule: RecurrenceRule, newDueDate: string): RecurrenceRule {
  const { month, day } = keyParts(newDueDate);
  if (rule.freq === "monthly") return { ...rule, byMonthDay: day };
  if (rule.freq === "yearly") return { ...rule, byMonth: month, byMonthDay: day };
  return rule;
}

/** Same schedule (weekday order doesn't matter). */
export function sameRule(a: RecurrenceRule | undefined, b: RecurrenceRule | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  const days = (rule: RecurrenceRule) =>
    rule.byWeekday ? [...rule.byWeekday].sort((x, y) => x - y).join(",") : "";
  return (
    a.freq === b.freq &&
    a.interval === b.interval &&
    days(a) === days(b) &&
    a.byMonthDay === b.byMonthDay &&
    a.byMonth === b.byMonth
  );
}

/**
 * The rule to save from the picker (Phase 4 B6). Monthly / yearly take day and month from the
 * due date, but only when the due date changed: an unchanged occurrence that was clamped to
 * 28 Feb keeps «am 31.».
 */
export function ruleForSave(
  state: PickerState,
  dueDate: string,
  original?: { rule?: RecurrenceRule; dueDate: string | null },
): RecurrenceRule | null {
  const rule = ruleFromPicker(state, dueDate);
  const before = original?.rule;
  if (!rule || !before || before.freq !== rule.freq || original?.dueDate !== dueDate) return rule;
  if (rule.freq === "monthly") return { ...rule, byMonthDay: before.byMonthDay };
  if (rule.freq === "yearly")
    return { ...rule, byMonth: before.byMonth, byMonthDay: before.byMonthDay };
  return rule;
}
