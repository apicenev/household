import { DEFAULT_PRIORITY } from "../../domain/tasks";
import type { NewTaskInput, Task, TaskPriority } from "../../types";

/** Form values; "" for no date (DateField). */
export interface TaskFormValues {
  title: string;
  notes: string;
  assigneeId: string | null;
  dueDate: string;
  priority: TaskPriority;
}

export function initialTaskFormValues(
  task: Task | undefined,
  prefill: Partial<NewTaskInput> = {},
): TaskFormValues {
  if (task) {
    return {
      title: task.title,
      notes: task.notes ?? "",
      assigneeId: task.assigneeId,
      dueDate: task.dueDate ?? "",
      priority: task.priority,
    };
  }
  return {
    title: prefill.title ?? "",
    notes: prefill.notes ?? "",
    assigneeId: prefill.assigneeId ?? null,
    dueDate: prefill.dueDate ?? "",
    priority: prefill.priority ?? DEFAULT_PRIORITY,
  };
}
