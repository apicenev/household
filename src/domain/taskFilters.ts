import type { TaskFilters } from "./tasks";

/**
 * Task filters ⇄ URL query (TSK-07, Phase 3 B3):
 * `?assignee=<uid>|none&due=overdue|today|week|none&priority=high`.
 * Member chips use the uid, so a shared link shows the same list to everyone.
 */

const DUE_VALUES = ["overdue", "today", "week", "none"] as const;

function isDue(value: string | null): value is NonNullable<TaskFilters["due"]> {
  return (DUE_VALUES as readonly (string | null)[]).includes(value);
}

/** Reads the filters; unknown values (e.g. the uid of someone who left) are ignored. */
export function parseTaskFilters(
  params: URLSearchParams,
  memberIds: readonly string[],
): TaskFilters {
  const filters: TaskFilters = {};
  const assignee = params.get("assignee");
  if (assignee === "none" || (assignee !== null && memberIds.includes(assignee))) {
    filters.assignee = assignee;
  }
  const due = params.get("due");
  if (isDue(due)) filters.due = due;
  if (params.get("priority") === "high") filters.priority = "high";
  return filters;
}

/** The query for `filters`, other parameters of `base` kept. */
export function taskFiltersToParams(
  filters: TaskFilters,
  base: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const params = new URLSearchParams(base);
  params.delete("assignee");
  params.delete("due");
  params.delete("priority");
  if (filters.assignee !== undefined) params.set("assignee", filters.assignee);
  if (filters.due !== undefined) params.set("due", filters.due);
  if (filters.priority !== undefined) params.set("priority", filters.priority);
  return params;
}
