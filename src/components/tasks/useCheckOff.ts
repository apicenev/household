import { ArrowUturnLeftIcon } from "@heroicons/react/16/solid";
import { useCallback, useEffect, useRef, useState } from "react";
import { actions as actionLabels } from "../../lib/copy";
import type { Task } from "../../types";
import { useToast } from "../ui/toastContext";
import type { TaskActions } from "./taskContext";

/** The window in which a second tap cancels a check-off (B6). */
export const CHECK_OFF_DELAY_MS = 700;
/** How long the «erledigt» toast with «Rückgängig» stays (design value, B6). */
export const COMPLETED_TOAST_MS = 5000;

/**
 * One-tap check-off (UI-06, TSK-04, B6): the row shows the tick at once; after 700 ms the
 * completion is written and a toast offers «Rückgängig». A second tap within the 700 ms
 * cancels. Leaving the page within the 700 ms writes the pending completions right away, so
 * a tick the user saw is never lost. A new completion replaces the previous toast.
 */
export function useCheckOff(tasks: Task[], taskActions: TaskActions) {
  const toast = useToast();
  const [checking, setChecking] = useState<ReadonlySet<string>>(() => new Set());
  const timers = useRef(new Map<string, number>());
  const toastId = useRef<string | null>(null);

  // Latest values for timers and the unmount flush.
  const latest = useRef({ tasks, taskActions, toast });
  useEffect(() => {
    latest.current = { tasks, taskActions, toast };
  });

  const finish = useCallback((taskId: string) => {
    const { tasks: current, taskActions: write, toast: toasts } = latest.current;
    const task = current.find((candidate) => candidate.id === taskId);
    // Completed or deleted by someone else meanwhile: nothing to do.
    if (!task || task.status !== "open") return;
    // Before the write: a recurring task's note names its next occurrence (Phase 4 D29).
    const message = write.completedMessage(task);
    write.complete(task);
    if (toastId.current) toasts.dismiss(toastId.current);
    toastId.current = toasts.show({
      message,
      duration: COMPLETED_TOAST_MS,
      action: {
        label: actionLabels.undo,
        icon: ArrowUturnLeftIcon,
        onClick: () => latest.current.taskActions.reopen(task),
      },
    });
  }, []);

  const toggle = useCallback(
    (taskId: string) => {
      const pending = timers.current.get(taskId);
      if (pending !== undefined) {
        window.clearTimeout(pending);
        timers.current.delete(taskId);
        setChecking((current) => without(current, taskId));
        return;
      }
      setChecking((current) => new Set(current).add(taskId));
      timers.current.set(
        taskId,
        window.setTimeout(() => {
          timers.current.delete(taskId);
          setChecking((current) => without(current, taskId));
          finish(taskId);
        }, CHECK_OFF_DELAY_MS),
      );
    },
    [finish],
  );

  // Leaving the page: write what the user ticked (only a second tap cancels).
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const [taskId, timer] of pending) {
        window.clearTimeout(timer);
        finish(taskId);
      }
      pending.clear();
    };
  }, [finish]);

  return { checking, toggle };
}

function without(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(set);
  next.delete(id);
  return next;
}
