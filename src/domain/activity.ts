import { toDateKey } from "../lib/format";
import type {
  ActivityEntry,
  ActivityTargetType,
  CalendarEvent,
  Member,
  ShoppingItem,
  Task,
} from "../types";
import { nextOccurrenceId } from "./tasks";

/**
 * The activity feed (ACT-03, ACT-04, ACT-08; Phase 8 B2, B3, D78–D80). Pure: entries come
 * newest first, day boundaries are in the household time zone. The wording lives in
 * `components/activity/activityLabels.ts`.
 */

/** Entries per page, live and per «Mehr laden» (ACT-04). */
export const ACTIVITY_PAGE_SIZE = 50;

/** Gap between two purchases that still makes them one row (D79). */
export const PURCHASE_GROUP_GAP_MS = 30 * 60 * 1000;

// ─── Filter (ACT-08, B3) ──────────────────────────────────────────────────────

/** The chips «Alle / Aufgaben / Einkauf / Kalender / Mitglieder»; each maps to a target type. */
export type ActivityFilter = "all" | ActivityTargetType;

export const ACTIVITY_FILTERS: readonly ActivityFilter[] = [
  "all",
  "task",
  "item",
  "event",
  "member",
];

/** The `targetType` the query filters by, `undefined` for «Alle». */
export function filterTargetType(filter: ActivityFilter): ActivityTargetType | undefined {
  return filter === "all" ? undefined : filter;
}

/** `?filter=task|item|event|member`; anything else is «Alle». */
export function parseActivityFilter(params: URLSearchParams): ActivityFilter {
  const value = params.get("filter");
  return (ACTIVITY_FILTERS as readonly (string | null)[]).includes(value) && value !== "all"
    ? (value as ActivityFilter)
    : "all";
}

/** The query for `filter`, other parameters of `base` kept («Alle» has none). */
export function activityFilterToParams(
  filter: ActivityFilter,
  base: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const params = new URLSearchParams(base);
  params.delete("filter");
  if (filter !== "all") params.set("filter", filter);
  return params;
}

// ─── Paging (B2) ──────────────────────────────────────────────────────────────

/** Newest first; the id keeps entries with the same time in a stable order. */
export function compareEntries(a: ActivityEntry, b: ActivityEntry): number {
  return b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id);
}

/**
 * The live page merged with what was loaded or seen before (B2): one item per entry id, the
 * live version winning (its pending time gets corrected), newest first. Entries pushed off the
 * live page by new ones stay, since entries never change (ACT-06). `T` carries the cursor.
 */
export function mergeFeed<T extends { entry: ActivityEntry }>(
  live: readonly T[],
  kept: readonly T[],
): T[] {
  const byId = new Map<string, T>();
  for (const item of kept) byId.set(item.entry.id, item);
  for (const item of live) byId.set(item.entry.id, item);
  return [...byId.values()].sort((a, b) => compareEntries(a.entry, b.entry));
}

// ─── Rows and days (D79, D80) ─────────────────────────────────────────────────

export type ActivityRow =
  | { kind: "single"; key: string; entry: ActivityEntry }
  /** Several purchases by one person (D79); `entries` newest first. */
  | { kind: "purchases"; key: string; entries: ActivityEntry[] };

/** The newest entry of a row (its time and actor). */
export function rowEntry(row: ActivityRow): ActivityEntry {
  return row.kind === "single" ? row.entry : row.entries[0];
}

/**
 * Consecutive `item_purchased` entries by the same person on the same day, each within 30
 * minutes of the next, become one row (D79). The row key is the **oldest** entry's id, so a
 * newer purchase joining the group keeps the key; a single entry's key is its own id.
 */
export function groupPurchases(entries: readonly ActivityEntry[], timeZone: string): ActivityRow[] {
  const rows: ActivityRow[] = [];
  let run: ActivityEntry[] = [];
  const flush = () => {
    if (run.length === 1) rows.push({ kind: "single", key: run[0].id, entry: run[0] });
    if (run.length > 1) rows.push({ kind: "purchases", key: run[run.length - 1].id, entries: run });
    run = [];
  };
  for (const entry of entries) {
    if (entry.type !== "item_purchased") {
      flush();
      rows.push({ kind: "single", key: entry.id, entry });
      continue;
    }
    const previous = run[run.length - 1];
    const joins =
      previous !== undefined &&
      previous.actorId === entry.actorId &&
      toDateKey(previous.createdAt, timeZone) === toDateKey(entry.createdAt, timeZone) &&
      previous.createdAt.getTime() - entry.createdAt.getTime() <= PURCHASE_GROUP_GAP_MS;
    if (!joins) flush();
    run.push(entry);
  }
  flush();
  return rows;
}

export interface ActivityDay {
  /** «2026-09-30» in the household zone. */
  dayKey: string;
  rows: ActivityRow[];
}

/** Rows by the day of their newest entry, newest day first (ACT-03). */
export function groupByDay(rows: readonly ActivityRow[], timeZone: string): ActivityDay[] {
  const days: ActivityDay[] = [];
  for (const row of rows) {
    const dayKey = toDateKey(rowEntry(row).createdAt, timeZone);
    const last = days[days.length - 1];
    if (last?.dayKey === dayKey) last.rows.push(row);
    else days.push({ dayKey, rows: [row] });
  }
  return days;
}

// ─── Actor and sub line (D78, D82) ────────────────────────────────────────────

/** The member behind `actorId`, `null` for someone no longer in the household (D82). */
export function actorOf(actorId: string, members: readonly Member[]): Member | null {
  return members.find((member) => member.uid === actorId) ?? null;
}

/** The live data the sub lines come from (D78). */
export interface LiveData {
  tasks: readonly Task[];
  items: readonly ShoppingItem[];
  events: readonly CalendarEvent[];
}

/** What a row's sub line is about (D78); `null` = no sub line. */
export type ActivitySubject =
  /** A series' next occurrence, still open. */
  | { kind: "nextOccurrence"; task: Task }
  | { kind: "item"; item: ShoppingItem }
  | { kind: "event"; event: CalendarEvent }
  /** The previous assignee's name snapshot, `null` for nobody. */
  | { kind: "previousAssignee"; name: string | null }
  /** Purchase group: the names, oldest purchase first. */
  | { kind: "purchases"; names: string[] }
  | null;

/**
 * The sub line's subject (D78): from the live target if it still exists, from the stored
 * details for an assignment, from the entries for a purchase group. Created tasks, single
 * purchases and joins have none.
 */
export function activitySubject(row: ActivityRow, live: LiveData): ActivitySubject {
  if (row.kind === "purchases") {
    return { kind: "purchases", names: [...row.entries].reverse().map((e) => e.targetTitle) };
  }
  const { entry } = row;
  switch (entry.type) {
    case "task_completed": {
      const task = live.tasks.find((candidate) => candidate.id === entry.targetId);
      const nextId = task ? nextOccurrenceId(task) : undefined;
      const next = nextId ? live.tasks.find((candidate) => candidate.id === nextId) : undefined;
      return next?.status === "open" ? { kind: "nextOccurrence", task: next } : null;
    }
    case "task_assigned": {
      const from = entry.details?.fromName;
      return { kind: "previousAssignee", name: typeof from === "string" ? from : null };
    }
    case "item_added": {
      const item = live.items.find((candidate) => candidate.id === entry.targetId);
      return item ? { kind: "item", item } : null;
    }
    case "event_created": {
      const event = live.events.find((candidate) => candidate.id === entry.targetId);
      return event ? { kind: "event", event } : null;
    }
    default:
      return null;
  }
}
