/** Priority of a task; always set, «Niedrig» by default (TSK-01, Phase 3 B1). */
export type TaskPriority = "low" | "medium" | "high";

export type TaskStatus = "open" | "done";

/** households/{hid}/tasks/{taskId} (TSK-01…09). Recurrence fields arrive in Phase 4. */
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
}

/**
 * Fields an edit changes (only the changed ones, B8). `notes: null` removes the notes.
 */
export interface TaskChanges {
  title?: string;
  notes?: string | null;
  assigneeId?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
}
