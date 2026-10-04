import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  buildNextOccurrence,
  isRecurring,
  isWriteOutcomeReached,
  todayKey,
  type RecurrenceContext,
  type TaskWriteIntent,
} from "../../domain/tasks";
import { useAuth } from "../../lib/auth/useAuth";
import { taskCopy } from "../../lib/copy";
import { completionNote } from "../../lib/recurrenceFormat";
import { GENERIC_WRITE_ERROR } from "../../lib/firestoreErrors";
import { useLoadedHousehold } from "../../lib/household/useHousehold";
import {
  completeTask,
  createTask,
  deleteOccurrence,
  deleteSeries,
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
  const { timeZone, weekStartsOn, memberIds } = household;

  // Recurring tasks (Phase 4): «today» at the moment of the write, in the household time zone.
  const recurrenceContext = useCallback(
    (): RecurrenceContext => ({ today: todayKey(new Date(), timeZone), weekStartsOn, memberIds }),
    [timeZone, weekStartsOn, memberIds],
  );

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
        watch(completeTask(householdId, task, uid, recurrenceContext()), task.id, "complete");
      },
      completedMessage(task: Task): string {
        if (!isRecurring(task)) return taskCopy.completedToast(task.title);
        const ctx = recurrenceContext();
        const next = buildNextOccurrence(task, ctx, { advanceRotation: true });
        const note = completionNote(
          {
            dueDate: next.dueDate,
            assigneeName: next.assigneeId ? memberById(next.assigneeId)?.displayName : undefined,
            rotates: next.rotation !== undefined,
          },
          ctx.today,
          timeZone,
        );
        return taskCopy.completedToastWithNote(task.title, note);
      },
      reopen(task: Task) {
        watch(reopenTask(householdId, task, tasksRef.current), task.id, "reopen");
      },
      remove(task: Task) {
        watch(deleteTask(householdId, task), task.id, "delete");
      },
      removeOccurrence(task: Task) {
        watch(deleteOccurrence(householdId, task, uid, recurrenceContext()), task.id, "delete");
      },
      removeSeries(task: Task) {
        watch(deleteSeries(householdId, task), task.id, "delete");
      },
    }),
    [householdId, uid, memberById, watch, recurrenceContext, timeZone],
  );
}
