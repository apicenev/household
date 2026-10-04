import { ArrowUturnLeftIcon } from "@heroicons/react/16/solid";
import { useCallback, useEffect, useRef } from "react";
import { useDelayedCheck } from "../../hooks/useDelayedCheck";
import { actions as actionLabels } from "../../lib/copy";
import type { Task } from "../../types";
import { useToast } from "../ui/toastContext";
import type { TaskActions } from "./taskContext";

export { CHECK_OFF_DELAY_MS } from "../../hooks/useDelayedCheck";
/** How long the «erledigt» toast with «Rückgängig» stays (design value, B6). */
export const COMPLETED_TOAST_MS = 5000;

/**
 * Task check-off (UI-06, TSK-04, B6) on top of `useDelayedCheck`: after the 700 ms window
 * the completion is written and a toast offers «Rückgängig». A new completion replaces the
 * previous toast.
 */
export function useCheckOff(tasks: Task[], taskActions: TaskActions) {
  const toast = useToast();
  const toastId = useRef<string | null>(null);

  // Latest values for the timers and the unmount flush.
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

  return useDelayedCheck(finish);
}
