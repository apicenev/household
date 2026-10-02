import { createContext, useContext } from "react";
import type { NewTaskInput, Task, TaskChanges } from "../../types";

export interface TaskActions {
  /** Creates a task; returns its id at once (D19). */
  create: (input: NewTaskInput) => string;
  update: (task: Task, changes: TaskChanges) => void;
  complete: (task: Task) => void;
  reopen: (task: Task) => void;
  remove: (task: Task) => void;
}

export interface OpenNewTaskOptions {
  /** Values to start with, e.g. from the Schnellerfassung («Mehr Optionen»). */
  prefill?: Partial<NewTaskInput>;
  /** Called with the new id after «Aufgabe hinzufügen» (desktop selection, D19). */
  onCreated?: (id: string) => void;
}

export interface TaskContextValue {
  actions: TaskActions;
  /** Opens «Neue Aufgabe» (D15). */
  openNewTask: (options?: OpenNewTaskOptions) => void;
  /** Opens «Aufgabe bearbeiten» for an open task. */
  openEditTask: (taskId: string) => void;
  /** Opens the delete confirmation (D22). */
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
