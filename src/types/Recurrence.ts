/** Frequency of a recurrence rule (requirements §7). */
export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";

/**
 * Recurrence rule of a task (Phase 4) and of an event (Phase 7). Weekdays use the JS
 * convention 0 = Sunday … 6 = Saturday (Phase 4 B3). `bySetPos`, `until` and `count` are
 * events-only (Phase 7 B1); tasks never write them and the rules reject them on tasks.
 */
export interface RecurrenceRule {
  freq: RecurrenceFreq;
  /** Every N units: 2 + weekly = every 2 weeks, 4 + daily = every 4 days (1–52). */
  interval: number;
  /**
   * Weekly: 1–7 distinct weekdays. Monthly by weekday (events): exactly one weekday, with
   * `bySetPos`.
   */
  byWeekday?: number[];
  /** Monthly and yearly: day of the month (1–31; shorter months use their last day). */
  byMonthDay?: number;
  /** Yearly only: month 1–12. */
  byMonth?: number;
  /** Events, monthly by weekday: 1–4 = «1. … 4. Samstag», −1 = «letzter Samstag» (D60). */
  bySetPos?: number;
  /** Events: last date an occurrence may start on, inclusive («2026-12-31», B5). */
  until?: string;
  /** Events: number of occurrences, counted from the first one (2–99, B5). */
  count?: number;
}

/**
 * Assignment rotation of a recurring task (RTK-05): every member in an order, `index` points
 * at the current assignee (`assigneeId == memberIds[index]`).
 */
export interface TaskRotation {
  memberIds: string[];
  index: number;
}
