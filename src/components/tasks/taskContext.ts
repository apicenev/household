import { createContext, useContext } from "react";
import type { NewTaskInput, Task, TaskChanges } from "../../types";

export interface TaskActions {
  /** Creates a task; returns its id at once (D19). */
  create: (input: NewTaskInput) => string;
  update: (task: Task, changes: TaskChanges) => void;
  complete: (task: Task) => void;
  /** Toast text after a completion: «Bad putzen» erledigt, with the D29 note if it repeats. */
  completedMessage: (task: Task) => string;
  /** Reopens; a completed occurrence takes back its untouched successor (RTK-10, B9). */
  reopen: (task: Task) => void;
  remove: (task: Task) => void;
  /** «Nur diese» (RTK-08, B8): deletes the occurrence, the next one is created. */
  removeOccurrence: (task: Task) => void;
  /** «Ganze Serie» (RTK-08): deletes the open occurrence; completed ones stay. */
  removeSeries: (task: Task) => void;
}

export interface OpenNewTaskOptions {
  /** Values to start with, e.g. from the Schnellerfassung («Mehr Optionen»). */
  prefill?: Partial<NewTaskInput>;
  /** Called with the new id after «Aufgabe hinzufügen» (desktop selection, D19). */
  onCreated?: (id: string) => void;
  /** Opens with «Wiederholen» focused (Schnellerfassung chip, Phase 4 D31). */
  focusRepeat?: boolean;
}

export interface TaskContextValue {
  actions: TaskActions;
  /** Opens «Neue Aufgabe» (D15). */
  openNewTask: (options?: OpenNewTaskOptions) => void;
  /** Opens «Aufgabe bearbeiten» for an open task. */
  openEditTask: (taskId: string) => void;
  /** Opens the delete confirmation (D22), for a recurring task with «Nur diese / Ganze Serie». */
  confirmDelete: (task: Task, onDeleted?: () => void) => void;
}

export const TaskContext = createContext<TaskContextValue | null>(null);

/** Task writes and the shared task sheet. Needs a <TaskProvider> (loaded household). */
export function useTasks(): TaskContextValue {
  const value = useContext(TaskContext);
  if (!value) throw new Error("useTasks() must be used inside <TaskProvider>.");
  return value;
}

/** Like useTasks(), but null outside a loaded household (shell error state, D8). */
export function useOptionalTasks(): TaskContextValue | null {
  return useContext(TaskContext);
}
