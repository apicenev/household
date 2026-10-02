import { toDateKey } from "../lib/format";
import type { NewTaskInput, Task, TaskChanges, TaskPriority, WeekStart } from "../types";

/**
 * Task rules (TSK-05, TSK-06, TSK-09, business rule §8.1). Pure: «today» is passed in as a
 * date key («2026-10-03») in the household time zone, so every comparison is between
 * calendar dates and works the same on every device.
 */

/** Longest title / notes the rules accept (TSK-01). */
export const MAX_TASK_TITLE = 200;
export const MAX_TASK_NOTES = 2000;

/** Completed tasks stay in «Erledigt» this long (TSK-09). */
export const RECENTLY_COMPLETED_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Default priority of new tasks (Phase 3 B1). */
export const DEFAULT_PRIORITY: TaskPriority = "low";

/** Today's calendar date in the household time zone. */
export function todayKey(now: Date, timeZone: string): string {
  return toDateKey(now, timeZone);
}

/** Groups of the open list, in display order (B4). */
export type DueGroup = "overdue" | "today" | "upcoming" | "none";

export const DUE_GROUPS: readonly DueGroup[] = ["overdue", "today", "upcoming", "none"];

export function dueGroup(dueDate: string | null, today: string): DueGroup {
  if (dueDate === null) return "none";
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";
  return "upcoming";
}

/** An open task due before today (business rule §8.1). */
export function isOverdue(task: Pick<Task, "status" | "dueDate">, today: string): boolean {
  return task.status === "open" && dueGroup(task.dueDate, today) === "overdue";
}

export function isDueToday(task: Pick<Task, "dueDate">, today: string): boolean {
  return task.dueDate === today;
}

/** Calendar days from date key `a` to date key `b` (b − a). */
export function daysBetweenKeys(a: string, b: string): number {
  return Math.round((keyToUtc(b) - keyToUtc(a)) / DAY_MS);
}

function keyToUtc(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function addDaysToKey(key: string, days: number): string {
  return new Date(keyToUtc(key) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Last day of the week containing `today`: Sunday when weeks start on Monday, Saturday when
 * they start on Sunday (HH-07).
 */
export function endOfWeekKey(today: string, weekStartsOn: WeekStart): string {
  const weekday = new Date(keyToUtc(today)).getUTCDay(); // 0 = Sunday … 6 = Saturday
  const lastDay = (weekStartsOn + 6) % 7;
  return addDaysToKey(today, (lastDay - weekday + 7) % 7);
}

const priorityRank: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

/**
 * TSK-06: due date ascending (no date last), then priority (Hoch → Niedrig), then creation
 * date (oldest first). Overdue tasks come first because their dates are the earliest.
 */
export function compareTasks(a: Task, b: Task): number {
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  const byPriority = priorityRank[a.priority] - priorityRank[b.priority];
  if (byPriority !== 0) return byPriority;
  const byCreation = a.createdAt.getTime() - b.createdAt.getTime();
  if (byCreation !== 0) return byCreation;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortTasks(tasks: readonly Task[]): Task[] {
  return [...tasks].sort(compareTasks);
}

export interface TaskGroup {
  group: DueGroup;
  tasks: Task[];
}

/** Open tasks in the four groups of the list (B4), sorted; empty groups are left out. */
export function groupOpenTasks(tasks: readonly Task[], today: string): TaskGroup[] {
  const open = sortTasks(tasks.filter((task) => task.status === "open"));
  return DUE_GROUPS.map((group) => ({
    group,
    tasks: open.filter((task) => dueGroup(task.dueDate, today) === group),
  })).filter((entry) => entry.tasks.length > 0);
}

/** Open tasks in display order (the groups one after the other). */
export function orderedOpenTasks(tasks: readonly Task[], today: string): Task[] {
  return groupOpenTasks(tasks, today).flatMap((entry) => entry.tasks);
}

/** Filters of the task list (B2). Missing = not filtered. */
export interface TaskFilters {
  /** A member uid, or "none" for «Nicht zugewiesen». */
  assignee?: string;
  due?: "overdue" | "today" | "week" | "none";
  priority?: "high";
}

export interface TaskFilterContext {
  today: string;
  weekStartsOn: WeekStart;
  /** Current members; an assignee who isn't one any more counts as unassigned (D23). */
  memberIds: readonly string[];
}

/** Whether `assigneeId` shows as «Nicht zugewiesen» (none, or someone who left). */
export function isUnassigned(assigneeId: string | null, memberIds: readonly string[]): boolean {
  return assigneeId === null || !memberIds.includes(assigneeId);
}

export function matchesFilters(task: Task, filters: TaskFilters, ctx: TaskFilterContext): boolean {
  if (filters.assignee !== undefined) {
    const matches =
      filters.assignee === "none"
        ? isUnassigned(task.assigneeId, ctx.memberIds)
        : task.assigneeId === filters.assignee;
    if (!matches) return false;
  }
  if (filters.due !== undefined) {
    const group = dueGroup(task.dueDate, ctx.today);
    switch (filters.due) {
      case "overdue":
        if (group !== "overdue") return false;
        break;
      case "today":
        if (group !== "today") return false;
        break;
      case "week":
        // Overdue, today and the rest of the current week (B4).
        if (task.dueDate === null || task.dueDate > endOfWeekKey(ctx.today, ctx.weekStartsOn)) {
          return false;
        }
        break;
      case "none":
        if (group !== "none") return false;
        break;
    }
  }
  if (filters.priority === "high" && task.priority !== "high") return false;
  return true;
}

/** Filters combine with AND (B2). */
export function filterTasks(
  tasks: readonly Task[],
  filters: TaskFilters,
  ctx: TaskFilterContext,
): Task[] {
  return tasks.filter((task) => matchesFilters(task, filters, ctx));
}

export function hasFilters(filters: TaskFilters): boolean {
  return (
    filters.assignee !== undefined || filters.due !== undefined || filters.priority !== undefined
  );
}

/**
 * Tasks completed in the last `days` days, newest first (B5, TSK-09). A completion exactly
 * `days` days ago is still included.
 */
export function recentlyCompleted(
  tasks: readonly Task[],
  now: Date,
  days = RECENTLY_COMPLETED_DAYS,
): Task[] {
  const since = now.getTime() - days * DAY_MS;
  return tasks
    .filter(
      (task): task is Task & { completedAt: Date } =>
        task.status === "done" &&
        task.completedAt !== undefined &&
        task.completedAt.getTime() >= since,
    )
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
}

/** «{n} offen · {n} überfällig · {n} heute fällig»: all open tasks, unfiltered (B4). */
export function taskSummary(
  tasks: readonly Task[],
  today: string,
): { open: number; overdue: number; today: number } {
  const open = tasks.filter((task) => task.status === "open");
  return {
    open: open.length,
    overdue: open.filter((task) => dueGroup(task.dueDate, today) === "overdue").length,
    today: open.filter((task) => task.dueDate === today).length,
  };
}

export function openTaskCount(tasks: readonly Task[]): number {
  return tasks.filter((task) => task.status === "open").length;
}

export type TaskTitleError = "empty" | "tooLong";

/** Trimmed title, or why it isn't valid (1–200 characters). */
export function validateTaskTitle(
  input: string,
): { ok: true; title: string } | { ok: false; error: TaskTitleError } {
  const title = input.trim();
  if (title.length === 0) return { ok: false, error: "empty" };
  if (title.length > MAX_TASK_TITLE) return { ok: false, error: "tooLong" };
  return { ok: true, title };
}

/** Trims title and notes; empty notes are dropped (B12). */
export function normalizeTaskInput(input: NewTaskInput): NewTaskInput {
  const notes = input.notes?.trim();
  const normalized: NewTaskInput = {
    title: input.title.trim(),
    assigneeId: input.assigneeId,
    dueDate: input.dueDate,
    priority: input.priority,
  };
  if (notes) normalized.notes = notes;
  return normalized;
}

/**
 * The fields an edit changes (B8), so two members editing different fields don't overwrite
 * each other. Removed notes come out as `notes: null`. `after` should be normalised.
 */
export function changedTaskFields(before: Task, after: NewTaskInput): TaskChanges {
  const changes: TaskChanges = {};
  if (after.title !== before.title) changes.title = after.title;
  if ((after.notes ?? undefined) !== before.notes) changes.notes = after.notes ?? null;
  if (after.assigneeId !== before.assigneeId) changes.assigneeId = after.assigneeId;
  if (after.dueDate !== before.dueDate) changes.dueDate = after.dueDate;
  if (after.priority !== before.priority) changes.priority = after.priority;
  return changes;
}

/** What a write was meant to achieve, for reporting a rejection (D21). */
export type TaskWriteIntent = "create" | "edit" | "complete" | "reopen" | "delete";

/**
 * Whether the task is already in the state a rejected write was meant to reach, so the
 * rejection can stay silent (D21): someone else completed, reopened or deleted it first.
 */
export function isWriteOutcomeReached(task: Task | undefined, intent: TaskWriteIntent): boolean {
  switch (intent) {
    case "complete":
      return task?.status === "done";
    case "reopen":
      return task?.status === "open";
    case "delete":
      return task === undefined;
    default:
      return false;
  }
}
