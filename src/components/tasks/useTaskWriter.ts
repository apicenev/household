import { useCallback, useEffect, useMemo, useRef } from "react";
import { isWriteOutcomeReached, type TaskWriteIntent } from "../../domain/tasks";
import { useAuth } from "../../lib/auth/useAuth";
import { taskCopy } from "../../lib/copy";
import { GENERIC_WRITE_ERROR } from "../../lib/firestoreErrors";
import { useLoadedHousehold } from "../../lib/household/useHousehold";
import {
  completeTask,
  createTask,
  deleteTask,
  reopenTask,
  updateTask,
} from "../../services/taskService";
import type { NewTaskInput, Task, TaskChanges } from "../../types";
import { useToast } from "../ui/toastContext";

/**
 * How long a rejection waits before it looks at the task (D21). Firestore rejects the write
 * before it rolls the optimistic change back in the listeners, so checking at once would
 * still see our own local write (e.g. «done» after a rejected completion).
 */
export const REJECTION_SETTLE_MS = 300;

/**
 * Task writes for the UI (one instance, in TaskProvider; use `useTasks().actions`). They don't wait for the server (B8): the listeners show the change
 * at once, and only a rejection is reported. A rejection stays silent when the task already
 * is where the write wanted it (someone else completed / reopened / deleted it first); an
 * edit or completion of a task that is gone shows «Diese Aufgabe wurde gelöscht.» (D21).
 */
export function useTaskWriter() {
  const { household, tasks, memberById } = useLoadedHousehold();
  const { user } = useAuth();
  const toast = useToast();
  const uid = user?.uid ?? "";
  const householdId = household.id;

  // The latest tasks, for rejections that arrive long after the call (offline queue).
  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const report = useCallback(
    (taskId: string, intent: TaskWriteIntent) => {
      window.setTimeout(() => {
        const current = tasksRef.current.find((task) => task.id === taskId);
        if (isWriteOutcomeReached(current, intent)) return;
        if (!current && (intent === "edit" || intent === "complete")) {
          toast.show({ message: taskCopy.deletedElsewhere, tone: "info" });
          return;
        }
        toast.show({ message: GENERIC_WRITE_ERROR, tone: "error" });
      }, REJECTION_SETTLE_MS);
    },
    [toast],
  );

  const watch = useCallback(
    (promise: Promise<void>, taskId: string, intent: TaskWriteIntent) => {
      promise.catch(() => report(taskId, intent));
    },
    [report],
  );

  return useMemo(
    () => ({
      /** Creates a task; returns its id at once (D19). */
      create(input: NewTaskInput): string {
        const { id, committed } = createTask(householdId, input, uid);
        watch(committed, id, "create");
        return id;
      },
      update(task: Task, changes: TaskChanges) {
        watch(
          updateTask(
            householdId,
            task,
            changes,
            uid,
            (memberId) => memberById(memberId)?.displayName,
          ),
          task.id,
          "edit",
        );
      },
      complete(task: Task) {
        watch(completeTask(householdId, task, uid), task.id, "complete");
      },
      reopen(task: Task) {
        watch(reopenTask(householdId, task), task.id, "reopen");
      },
      remove(task: Task) {
        watch(deleteTask(householdId, task), task.id, "delete");
      },
    }),
    [householdId, uid, memberById, watch],
  );
}
