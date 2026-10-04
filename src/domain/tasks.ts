import { toDateKey } from "../lib/format";
import { daysBetweenKeys, endOfWeekKey } from "./dateKeys";
import { nextDueDate, sameRule } from "./recurrence";
import { nextAssignee, pruneRotation, sameRotation } from "./rotation";
import type {
  NewTaskInput,
  RecurrenceRule,
  Task,
  TaskChanges,
  TaskPriority,
  TaskRotation,
  WeekStart,
} from "../types";

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

export { daysBetweenKeys, endOfWeekKey };

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

/** Trims title and notes; empty notes are dropped (B12). A rotation needs a rule. */
export function normalizeTaskInput(input: NewTaskInput): NewTaskInput {
  const notes = input.notes?.trim();
  const normalized: NewTaskInput = {
    title: input.title.trim(),
    assigneeId: input.assigneeId,
    dueDate: input.dueDate,
    priority: input.priority,
  };
  if (notes) normalized.notes = notes;
  if (input.recurrence) {
    normalized.recurrence = input.recurrence;
    if (input.rotation) normalized.rotation = input.rotation;
  }
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
  // Deep comparisons, so an untouched rule or rotation is never written (Phase 4 B4).
  if (!sameRule(after.recurrence, before.recurrence)) {
    changes.recurrence = after.recurrence ?? null;
  }
  if (!sameRotation(after.rotation, before.rotation)) changes.rotation = after.rotation ?? null;
  return changes;
}

/**
 * A recurring task in the sense of Phase 4: open and with a rule. A completed occurrence keeps
 * its rule as history (B7) and doesn't count.
 */
export function isRecurring(task: Task): task is Task & {
  recurrence: RecurrenceRule;
  dueDate: string;
  seriesId: string;
  seriesIndex: number;
} {
  return (
    task.status === "open" &&
    task.recurrence !== undefined &&
    task.dueDate !== null &&
    task.seriesId !== undefined &&
    task.seriesIndex !== undefined
  );
}

/** Id of the occurrence generated after `task`: «{seriesId}-{seriesIndex + 1}» (B5). */
export function nextOccurrenceId(task: Pick<Task, "seriesId" | "seriesIndex">): string | undefined {
  if (task.seriesId === undefined || task.seriesIndex === undefined) return undefined;
  return `${task.seriesId}-${task.seriesIndex + 1}`;
}

/** What the next occurrence is computed from. */
export interface RecurrenceContext {
  /** Today in the household time zone. */
  today: string;
  weekStartsOn: WeekStart;
  /** Current members; former members are dropped from the assignee and the rotation. */
  memberIds: readonly string[];
}

/** Fields of a generated occurrence (without status, author and times). */
export interface NextOccurrence {
  id: string;
  title: string;
  notes?: string;
  assigneeId: string | null;
  dueDate: string;
  priority: TaskPriority;
  recurrence: RecurrenceRule;
  rotation?: TaskRotation;
  seriesId: string;
  seriesIndex: number;
}

/**
 * The occurrence after `task` (RTK-03…05): due on the next schedule date ≥ today. On a
 * completion the rotation moves on (B7); for «Nur diese» (`advanceRotation: false`, B8) the
 * same person keeps the turn. Former members are pruned either way.
 */
export function buildNextOccurrence(
  task: Task,
  ctx: RecurrenceContext,
  { advanceRotation }: { advanceRotation: boolean },
): NextOccurrence {
  if (!isRecurring(task)) throw new Error(`Task ${task.id} doesn't repeat`);

  let assigneeId =
    task.assigneeId !== null && ctx.memberIds.includes(task.assigneeId) ? task.assigneeId : null;
  let rotation: TaskRotation | null = null;
  if (task.rotation) {
    const next = advanceRotation
      ? nextAssignee(task.rotation, ctx.memberIds)
      : pruneRotation(task.rotation, ctx.memberIds);
    rotation = next.rotation;
    assigneeId = next.assigneeId;
  }

  const seriesIndex = task.seriesIndex + 1;
  const next: NextOccurrence = {
    id: `${task.seriesId}-${seriesIndex}`,
    title: task.title,
    assigneeId,
    dueDate: nextDueDate(task.recurrence, task.dueDate, ctx.today, ctx.weekStartsOn),
    priority: task.priority,
    recurrence: task.recurrence,
    seriesId: task.seriesId,
    seriesIndex,
  };
  if (task.notes !== undefined) next.notes = task.notes;
  if (rotation) next.rotation = rotation;
  return next;
}

/**
 * Still exactly as generated (B9): open and never edited. A create writes `createdAt` and
 * `updatedAt` with the same server time.
 */
export function isUntouched(task: Task): boolean {
  return task.status === "open" && task.createdAt.getTime() === task.updatedAt.getTime();
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
