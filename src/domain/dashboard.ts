import type { CalendarEvent, EventOccurrence, ShoppingItem, Task, WeekStart } from "../types";
import { occurrencesInRange, upcoming } from "./calendar";
import { addDaysToKey } from "./dateKeys";
import { groupByCategory } from "./shopping";
import { dueGroup, sortTasks, todayKey } from "./tasks";

/**
 * What Start shows (Phase 8 B4, `Dashboard.dc.html`). Pure: `today` is a date key and `now`
 * an instant, both in the household time zone, so the sections switch at local midnight.
 */

/** Open items shown in «Einkauf» (DSH-05). */
export const SHOPPING_PREVIEW_ROWS = 5;

/** Completed tasks shown in «Kürzlich erledigt» (DSH-06). */
export const RECENT_ROWS = 5;

/** Days «Demnächst» looks ahead on Start, today included (DSH-04). */
export const DASHBOARD_UPCOMING_DAYS = 7;

/** «Überfällig»: open tasks due before today, every member, in Aufgaben order (DSH-03). */
export function overdueTasks(tasks: readonly Task[], today: string): Task[] {
  return sortTasks(
    tasks.filter((task) => task.status === "open" && dueGroup(task.dueDate, today) === "overdue"),
  );
}

/** «Heute»: open tasks due today, every member (DSH-02). */
export function todayTasks(tasks: readonly Task[], today: string): Task[] {
  return sortTasks(tasks.filter((task) => task.status === "open" && task.dueDate === today));
}

/**
 * What «Heute» shows (D67): its rows while something due today is open; «Alles erledigt 🎉»
 * only when nothing is overdue and at least one task due today was completed; otherwise the
 * «Heute steht nichts an.» line (nothing was due, or only overdue tasks are left).
 */
export type TodayState = "open" | "allDone" | "nothingDue";

export function todayState(tasks: readonly Task[], today: string): TodayState {
  if (todayTasks(tasks, today).length > 0) return "open";
  const completedToday = tasks.some((task) => task.status === "done" && task.dueDate === today);
  return completedToday && overdueTasks(tasks, today).length === 0 ? "allDone" : "nothingDue";
}

/** «Als Nächstes: …» (D68): the earliest open task due after today, or `null`. */
export function nextDueTask(tasks: readonly Task[], today: string): Task | null {
  return (
    sortTasks(
      tasks.filter(
        (task) => task.status === "open" && task.dueDate !== null && task.dueDate > today,
      ),
    )[0] ?? null
  );
}

/**
 * «Kürzlich erledigt» (DSH-06, B4): the last `count` completions, newest first, no time window;
 * completed occurrences of series count like any task.
 */
export function lastCompleted(
  tasks: readonly Task[],
  count = RECENT_ROWS,
): (Task & { completedAt: Date })[] {
  return tasks
    .filter(
      (task): task is Task & { completedAt: Date } =>
        task.status === "done" && task.completedAt !== undefined,
    )
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime() || a.id.localeCompare(b.id))
    .slice(0, count);
}

/** «Einkauf» (DSH-05): the first open items in Einkauf order, and how many are open. */
export function shoppingPreview(
  items: readonly ShoppingItem[],
  count = SHOPPING_PREVIEW_ROWS,
): { items: ShoppingItem[]; openCount: number } {
  const open = groupByCategory(items).flatMap((group) => group.items);
  return { items: open.slice(0, count), openCount: open.length };
}

export interface UpcomingRow {
  /** The day the row stands on (today for a running multi-day event). */
  dayKey: string;
  occurrence: EventOccurrence;
}

/**
 * «Demnächst» on Start (DSH-04, B4): every occurrence (series expanded) that isn't over and
 * starts within the next 7 days, one row each, in calendar order; a running multi-day event
 * stands on today.
 */
export function upcomingWeek(
  events: readonly CalendarEvent[],
  now: Date,
  timeZone: string,
  weekStartsOn: WeekStart,
): UpcomingRow[] {
  const today = todayKey(now, timeZone);
  const occurrences = occurrencesInRange(
    events,
    today,
    addDaysToKey(today, DASHBOARD_UPCOMING_DAYS - 1),
    timeZone,
    weekStartsOn,
  );
  return upcoming(occurrences, now, timeZone, DASHBOARD_UPCOMING_DAYS).flatMap((group) =>
    group.occurrences.map((occurrence) => ({ dayKey: group.dayKey, occurrence })),
  );
}
