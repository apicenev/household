import type { RecurrenceRule, TaskRotation } from "./Recurrence";

/** Priority of a task; always set, «Niedrig» by default (TSK-01, Phase 3 B1). */
export type TaskPriority = "low" | "medium" | "high";

export type TaskStatus = "open" | "done";

/** households/{hid}/tasks/{taskId} (TSK-01…09, RTK-01…10). */
export interface Task {
  id: string;
  /** 1–200 characters, trimmed. */
  title: string;
  /** 1–2000 characters; missing when the task has no notes. */
  notes?: string;
  /** Member uid, or null for «Nicht zugewiesen». */
  assigneeId: string | null;
  /** Calendar date «2026-10-03» (NFR-09), or null for «Ohne Datum». */
  dueDate: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  /** Server time of the completion (done tasks only). */
  completedAt?: Date;
  /** Who completed it (done tasks only). */
  completedBy?: string;
  /**
   * Series of a recurring task: a random id per series, set when the task gets a rule
   * (Phase 4 B5). Generated occurrences have the id «{seriesId}-{seriesIndex}».
   */
  seriesId?: string;
  /** Position in the series: 1 for the first occurrence, then 2, 3, … */
  seriesIndex?: number;
  /**
   * The rule. Active while the task is open; a completed occurrence keeps it as history
   * (B7), so «recurring» means open and with a rule (`isRecurring`).
   */
  recurrence?: RecurrenceRule;
  /** Rotation of the assignee (needs `recurrence`). */
  rotation?: TaskRotation;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  /** A local write to this task hasn't reached the server yet (B14). Read model only. */
  hasPendingWrites: boolean;
}

/** What the task sheet and the Schnellerfassung produce. */
export interface NewTaskInput {
  title: string;
  /** Omitted (or empty) for no notes. */
  notes?: string;
  assigneeId: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  /** Omitted for a task that doesn't repeat. */
  recurrence?: RecurrenceRule;
  /** Omitted without rotation; needs `recurrence`. */
  rotation?: TaskRotation;
}

/**
 * Fields an edit changes (only the changed ones, B8). `null` removes notes, the rule («Nie»,
 * end repeat; the rotation goes with it) or the rotation.
 */
export interface TaskChanges {
  title?: string;
  notes?: string | null;
  assigneeId?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
  recurrence?: RecurrenceRule | null;
  rotation?: TaskRotation | null;
}
