/** Frequency of a recurrence rule (requirements §7). */
export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";

/**
 * Recurrence rule of a task (Phase 4) and, from Phase 7, of an event. Weekdays use the JS
 * convention 0 = Sunday … 6 = Saturday (Phase 4 B3). Phase 7 adds `bySetPos`, `until` and
 * `count`; tasks never write them.
 */
export interface RecurrenceRule {
  freq: RecurrenceFreq;
  /** Every N units: 2 + weekly = every 2 weeks, 4 + daily = every 4 days (1–52). */
  interval: number;
  /** Weekly only: 1–7 distinct weekdays. */
  byWeekday?: number[];
  /** Monthly and yearly: day of the month (1–31; shorter months use their last day). */
  byMonthDay?: number;
  /** Yearly only: month 1–12. */
  byMonth?: number;
}

/**
 * Assignment rotation of a recurring task (RTK-05): every member in an order, `index` points
 * at the current assignee (`assigneeId == memberIds[index]`).
 */
export interface TaskRotation {
  memberIds: string[];
  index: number;
}
