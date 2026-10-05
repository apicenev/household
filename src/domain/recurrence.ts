import type { RecurrenceRule, WeekStart } from "../types";
import {
  addDaysToKey,
  dateKey,
  daysBetweenKeys,
  daysInMonth,
  isDateKey,
  keyParts,
  startOfWeekKey,
  weekdayOfKey,
} from "./dateKeys";

/**
 * Recurrence engine (RTK-01…03, business rule §8.2), shared by recurring tasks (Phase 4) and
 * recurring events (Phase 7: REV-01…05, §8.6). Pure, on calendar date keys («2026-10-03»),
 * so DST can't move a date.
 *
 * The schedule is anchored at a date (tasks: the current occurrence's due date, Phase 4 B1;
 * events: the first occurrence, Phase 7 B3): «every N days» counts days from the anchor,
 * «every N weeks» counts weeks from the anchor's week (household week start), monthly /
 * yearly count months / years from it. Nothing before the anchor is ever on the schedule.
 */

export const MIN_INTERVAL = 1;
export const MAX_INTERVAL = 52;

/** «Nach N Mal» (Phase 7 B5): 2–99, the stepper starts at 10 (`RecurrencePicker.dc.html`). */
export const MIN_COUNT = 2;
export const MAX_COUNT = 99;
export const DEFAULT_COUNT = 10;

/** Monthly by weekday (D60): «1. … 4. Samstag» and «letzter Samstag». */
export const SET_POSITIONS: readonly number[] = [1, 2, 3, 4, -1];

/** At most this many occurrences per event and expansion (§8.6, Phase 7 B6). */
export const MAX_OCCURRENCES = 500;

/** Safety cap for the day-by-day search (a valid rule always matches far earlier). */
const MAX_STEPS = 1000;

/** Every valid rule has an occurrence in any window of this many days after its anchor. */
const LONGEST_GAP_DAYS = 367;

export type RuleProblem =
  "interval" | "weekdays" | "monthDay" | "month" | "keys" | "setPos" | "until" | "count" | "end";

const allowedKeys: Record<RecurrenceRule["freq"], readonly string[]> = {
  daily: ["freq", "interval"],
  weekly: ["freq", "interval", "byWeekday"],
  monthly: ["freq", "interval", "byMonthDay"],
  yearly: ["freq", "interval", "byMonth", "byMonthDay"],
};

function isIntIn(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Whether a task rule is complete and consistent (the same checks as `firestore.rules`).
 * Rejects the events-only `bySetPos`, `until` and `count` («keys»).
 */
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

/**
 * Whether an event rule is complete and consistent (Phase 7 B1, mirrored by
 * `validEventRecurrence` in `firestore.rules`): the task shapes, plus monthly by weekday
 * (`byWeekday: [d]` + `bySetPos`, no `byMonthDay`) and either `until` or `count`.
 */
export function validateEventRule(
  rule: RecurrenceRule,
): { ok: true } | { ok: false; problem: RuleProblem } {
  const { until, count, ...core } = rule;
  if (until !== undefined && count !== undefined) return { ok: false, problem: "end" };
  if (until !== undefined && !isDateKey(until)) return { ok: false, problem: "until" };
  if (count !== undefined && !isIntIn(count, MIN_COUNT, MAX_COUNT)) {
    return { ok: false, problem: "count" };
  }
  if (core.freq !== "monthly" || core.bySetPos === undefined) return validateRule(core);
  const keys = Object.keys(core).filter((key) => core[key as keyof typeof core] !== undefined);
  if (!keys.every((key) => ["freq", "interval", "byWeekday", "bySetPos"].includes(key))) {
    return { ok: false, problem: "keys" };
  }
  if (core.interval !== 1) return { ok: false, problem: "interval" };
  const days = core.byWeekday ?? [];
  if (days.length !== 1 || !isIntIn(days[0], 0, 6)) return { ok: false, problem: "weekdays" };
  if (!SET_POSITIONS.includes(core.bySetPos)) return { ok: false, problem: "setPos" };
  return { ok: true };
}

/** Day `byMonthDay` of a month, clamped to its last day (31 → 30 Apr / 28 Feb, REV-05). */
function clampedDay(year: number, month: number, byMonthDay: number): string {
  return dateKey(year, month, Math.min(byMonthDay, daysInMonth(year, month)));
}

/** The `position`-th `weekday` of a month (1–4), or the last one (−1). */
export function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  position: number,
): string {
  if (position < 0) {
    const last = daysInMonth(year, month);
    const back = (weekdayOfKey(dateKey(year, month, last)) - weekday + 7) % 7;
    return dateKey(year, month, last - back);
  }
  const ahead = (weekday - weekdayOfKey(dateKey(year, month, 1)) + 7) % 7;
  return dateKey(year, month, 1 + ahead + (position - 1) * 7);
}

/**
 * The position of a date's weekday in its month (D60): days 1–7 → 1 … 22–28 → 4; the 5th
 * one (29–31) is «der letzte» (−1).
 */
export function setPosOf(key: string): number {
  const position = Math.ceil(keyParts(key).day / 7);
  return position === 5 ? -1 : position;
}

/**
 * The first date on the schedule strictly after `after`. Dates before the anchor are never
 * returned (the anchor's week / month / year is the first one of the schedule). Ignores
 * `until` / `count`; `occurrenceDates` applies them.
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
      // The anchor, not its week start: earlier days of the anchor's week aren't on the
      // schedule (Phase 7 review: Thu anchor, «Di, Sa» must not return the Tuesday before).
      if (candidate < anchor) candidate = anchor;
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
        const year = start.year + Math.floor(total / 12);
        const month = (total % 12) + 1;
        const candidate =
          rule.bySetPos === undefined
            ? clampedDay(year, month, rule.byMonthDay ?? start.day)
            : nthWeekdayOfMonth(
                year,
                month,
                rule.byWeekday?.[0] ?? weekdayOfKey(anchor),
                rule.bySetPos,
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

/**
 * The first schedule date on or after `startKey`, anchored there (Phase 7 B3): an event's
 * start is moved to it on save, so the stored start is always the first occurrence.
 */
export function snapToSchedule(
  rule: RecurrenceRule,
  startKey: string,
  weekStartsOn: WeekStart,
): string {
  return nextOccurrence(rule, addDaysToKey(startKey, -1), startKey, weekStartsOn);
}

/** The last date `until` / `count` allow (inclusive), or `null` for a series without end. */
function endBound(rule: RecurrenceRule, anchor: string, weekStartsOn: WeekStart): string | null {
  if (rule.until !== undefined) return rule.until;
  if (rule.count === undefined) return null;
  let key = snapToSchedule(rule, anchor, weekStartsOn);
  for (let n = 1; n < rule.count; n++) key = nextOccurrence(rule, key, anchor, weekStartsOn);
  return key;
}

/**
 * The occurrence dates within `firstKey` … `lastKey` (inclusive), honouring `until` and
 * `count` (B5), at most `cap` of them (§8.6). Jumps straight to the range (B6), so an old
 * series costs the same as a new one.
 */
export function occurrenceDates(
  rule: RecurrenceRule,
  anchor: string,
  firstKey: string,
  lastKey: string,
  weekStartsOn: WeekStart,
  cap = MAX_OCCURRENCES,
): string[] {
  const bound = endBound(rule, anchor, weekStartsOn);
  const stop = bound !== null && bound < lastKey ? bound : lastKey;
  const from = firstKey > anchor ? firstKey : anchor;
  const dates: string[] = [];
  if (from > stop) return dates;
  let key = nextOccurrence(rule, addDaysToKey(from, -1), anchor, weekStartsOn);
  while (key <= stop && dates.length < cap) {
    dates.push(key);
    key = nextOccurrence(rule, key, anchor, weekStartsOn);
  }
  return dates;
}

/**
 * First and last occurrence of a series anchored at `anchor` (D63); `last` is `null` when it
 * never ends. `null` for a series without any occurrence (an `until` before the first match,
 * which the form prevents, D66).
 */
export function seriesRange(
  rule: RecurrenceRule,
  anchor: string,
  weekStartsOn: WeekStart,
): { first: string; last: string | null } | null {
  const first = snapToSchedule(rule, anchor, weekStartsOn);
  if (rule.until !== undefined) {
    if (rule.until < first) return null;
    // A valid rule matches within any LONGEST_GAP_DAYS window, so the last one is in there.
    const tail = occurrenceDates(
      rule,
      anchor,
      addDaysToKey(rule.until, -LONGEST_GAP_DAYS),
      rule.until,
      weekStartsOn,
      LONGEST_GAP_DAYS + 1,
    );
    return { first, last: tail[tail.length - 1] ?? first };
  }
  return { first, last: endBound(rule, anchor, weekStartsOn) };
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

/**
 * An event rule after its start moved to `startKey` (Phase 7 B10): monthly by day / yearly as
 * `withDueDate`, monthly by weekday takes the new weekday and position (D60) and never gets a
 * `byMonthDay` next to its `bySetPos`. `until` / `count` stay.
 */
export function withStartDate(rule: RecurrenceRule, startKey: string): RecurrenceRule {
  if (rule.freq === "monthly" && rule.bySetPos !== undefined) {
    return { ...rule, byWeekday: [weekdayOfKey(startKey)], bySetPos: setPosOf(startKey) };
  }
  return withDueDate(rule, startKey);
}

/** Same schedule and end (weekday order doesn't matter). */
export function sameRule(a: RecurrenceRule | undefined, b: RecurrenceRule | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  const days = (rule: RecurrenceRule) =>
    rule.byWeekday ? [...rule.byWeekday].sort((x, y) => x - y).join(",") : "";
  return (
    a.freq === b.freq &&
    a.interval === b.interval &&
    days(a) === days(b) &&
    a.byMonthDay === b.byMonthDay &&
    a.byMonth === b.byMonth &&
    a.bySetPos === b.bySetPos &&
    a.until === b.until &&
    a.count === b.count
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

/** Monthly segment of the event picker (`RecurrencePicker.dc.html`): «Am 3.» / «Am 1. Samstag». */
export type MonthlyMode = "day" | "weekday";

/** «Endet»: «Nie» / «Am Datum» / «Nach N Mal» (REV-02). */
export type PickerEnd = "never" | "date" | "after";

/** The event picker (Phase 7 B2): the task chips plus the monthly segment and «Endet». */
export interface EventPickerState extends PickerState {
  monthlyMode: MonthlyMode;
  end: PickerEnd;
  /** For «Am Datum»; kept while another end is picked. */
  until: string;
  /** For «Nach N Mal» (2–99). */
  count: number;
}

/** «Am Datum» default (D59): the last day of the third month after the start. */
export function defaultUntil(startKey: string): string {
  const { year, month } = keyParts(startKey);
  const total = month - 1 + 3;
  const endYear = year + Math.floor(total / 12);
  const endMonth = (total % 12) + 1;
  return dateKey(endYear, endMonth, daysInMonth(endYear, endMonth));
}

/** Event picker state for a stored rule (or none), anchored at the event's start. */
export function eventPickerFromRule(
  rule: RecurrenceRule | undefined,
  startKey: string,
): EventPickerState {
  let end: PickerEnd = "never";
  if (rule?.until !== undefined) end = "date";
  else if (rule?.count !== undefined) end = "after";
  return {
    ...pickerFromRule(rule, startKey),
    monthlyMode: rule?.bySetPos !== undefined ? "weekday" : "day",
    end,
    until: rule?.until ?? defaultUntil(startKey),
    count: rule?.count ?? DEFAULT_COUNT,
  };
}

/**
 * The event rule a picker state stands for; `null` for «Nie». Monthly / yearly take day,
 * weekday position and month from the start (B3, D60), so the start is always on the schedule.
 */
export function eventRuleFromPicker(
  state: EventPickerState,
  startKey: string,
): RecurrenceRule | null {
  let rule = ruleFromPicker(state, startKey);
  if (!rule) return null;
  if (rule.freq === "monthly" && state.monthlyMode === "weekday") {
    rule = {
      freq: "monthly",
      interval: 1,
      byWeekday: [weekdayOfKey(startKey)],
      bySetPos: setPosOf(startKey),
    };
  }
  if (state.end === "date") return { ...rule, until: state.until };
  if (state.end === "after") {
    return { ...rule, count: Math.min(MAX_COUNT, Math.max(MIN_COUNT, state.count)) };
  }
  return rule;
}
