import { TrashIcon } from "@heroicons/react/20/solid";
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { changedTaskFields, isRecurring, validateTaskTitle } from "../../domain/tasks";
import { useIsDesktop } from "../../hooks/useMediaQuery";
import { useToday } from "../../hooks/useToday";
import { actions as actionLabels, taskCopy } from "../../lib/copy";
import { formatDate, fromDateKey } from "../../lib/format";
import { useLoadedHousehold } from "../../lib/household/useHousehold";
import { describeRuleInSentence, weekdayPlural } from "../../lib/recurrenceFormat";
import type { Task } from "../../types";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/toastContext";
import { SeriesDeleteChoice, type SeriesChoice } from "./SeriesDeleteChoice";
import { TaskForm } from "./TaskForm";
import { initialTaskFormValues, taskInputFromValues, type TaskFormValues } from "./taskFormValues";
import {
  TaskContext,
  useTasks,
  type OpenNewTaskOptions,
  type TaskContextValue,
} from "./taskContext";
import { useTaskWriter } from "./useTaskWriter";

type SheetState = { mode: "new"; options: OpenNewTaskOptions } | { mode: "edit"; taskId: string };

interface DeleteState {
  task: Task;
  onDeleted?: () => void;
}

/**
 * Task writes plus the one shared «Neue Aufgabe» / «Aufgabe bearbeiten» sheet and the delete
 * confirmation (Phase 3 §3.9). Mounted around the shell of a loaded household, so the
 * Aufgaben page, the empty state and the Schnellerfassung open the same sheet.
 */
export function TaskProvider({ children }: { children: ReactNode }) {
  const actions = useTaskWriter();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  // Bumped on every open, so the form starts from fresh values.
  const [sheetKey, setSheetKey] = useState(0);
  const [deleting, setDeleting] = useState<DeleteState | null>(null);
  const [seriesChoice, setSeriesChoice] = useState<SeriesChoice>("one");
  const { household, members } = useLoadedHousehold();

  const openNewTask = useCallback((options: OpenNewTaskOptions = {}) => {
    setSheet({ mode: "new", options });
    setSheetKey((key) => key + 1);
  }, []);

  const openEditTask = useCallback((taskId: string) => {
    setSheet({ mode: "edit", taskId });
    setSheetKey((key) => key + 1);
  }, []);

  const closeSheet = useCallback(() => setSheet(null), []);

  const confirmDelete = useCallback((task: Task, onDeleted?: () => void) => {
    setDeleting({ task, onDeleted });
    setSeriesChoice("one");
  }, []);

  // A recurring task asks «Nur diese / Ganze Serie» (RTK-08, Phase 4 B8).
  const recurring = deleting && isRecurring(deleting.task) ? deleting.task : null;

  const value = useMemo<TaskContextValue>(
    () => ({ actions, openNewTask, openEditTask, confirmDelete }),
    [actions, openNewTask, openEditTask, confirmDelete],
  );

  return (
    <TaskContext.Provider value={value}>
      {children}
      <TaskSheet
        key={sheetKey}
        state={sheet}
        onClose={closeSheet}
        onDelete={(task) => confirmDelete(task)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          // Close the sheet first, so its «deleted elsewhere» check doesn't fire (D20).
          setSheet(null);
          if (!recurring) actions.remove(deleting.task);
          else if (seriesChoice === "one") actions.removeOccurrence(recurring);
          else actions.removeSeries(recurring);
          deleting.onDeleted?.();
          setDeleting(null);
        }}
        title={deleting ? taskCopy.deleteTitle(deleting.task.title) : ""}
        text={
          recurring
            ? taskCopy.series.text(
                describeRuleInSentence(recurring.recurrence, household.weekStartsOn),
              )
            : taskCopy.deleteText(members.map((member) => member.displayName))
        }
        confirmLabel={
          !recurring
            ? actionLabels.delete
            : seriesChoice === "one"
              ? taskCopy.series.oneCta
              : taskCopy.series.allCta
        }
      >
        {recurring && (
          <SeriesDeleteChoice
            value={seriesChoice}
            onChange={setSeriesChoice}
            oneHint={taskCopy.series.oneHint(
              formatDate(fromDateKey(recurring.dueDate), household.timeZone),
            )}
            allHint={taskCopy.series.allHint(weekdayPlural(recurring.recurrence))}
          />
        )}
      </ConfirmDialog>
    </TaskContext.Provider>
  );
}

/**
 * The sheet (phones) / the two-column 840 px dialog (desktop, Phase 4; ends D16).
 * Closes as soon as the user saves (B8); closes with a toast when the task is deleted or
 * completed by someone else meanwhile (D20, D25).
 */
function TaskSheet({
  state,
  onClose,
  onDelete,
}: {
  state: SheetState | null;
  onClose: () => void;
  onDelete: (task: Task) => void;
}) {
  const { household, members, tasks } = useLoadedHousehold();
  const { actions } = useTasks();
  const toast = useToast();
  const desktop = useIsDesktop();
  const today = useToday(household.timeZone);
  const formId = useId();

  const editId = state?.mode === "edit" ? state.taskId : undefined;
  const task = editId ? tasks.find((candidate) => candidate.id === editId) : undefined;
  const prefill = state?.mode === "new" ? state.options.prefill : undefined;
  const focusRepeat = state?.mode === "new" && state.options.focusRepeat === true;

  const [values, setValues] = useState<TaskFormValues>(() =>
    initialTaskFormValues(task, prefill, members),
  );
  const [titleError, setTitleError] = useState<string | undefined>();
  // The task as it was when the sheet opened: the base for «only changed fields» (B8).
  const [original] = useState(task);

  // Deleted or completed elsewhere while open (D20, D25): close, with a toast.
  const vanished = !editId ? null : !task ? "deleted" : task.status === "done" ? "completed" : null;
  useEffect(() => {
    if (!vanished) return;
    toast.show({
      message: vanished === "deleted" ? taskCopy.deletedElsewhere : taskCopy.completedElsewhere,
      tone: "info",
    });
    onClose();
  }, [vanished, toast, onClose]);

  function change(patch: Partial<TaskFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
    if (patch.title?.trim()) setTitleError(undefined);
  }

  function submit() {
    const title = validateTaskTitle(values.title);
    if (!title.ok) {
      setTitleError(taskCopy.titleEmpty);
      return;
    }
    const input = taskInputFromValues(values, title.title, original);
    if (state?.mode === "new") {
      const id = actions.create(input);
      state.options.onCreated?.(id);
    } else if (original && task) {
      actions.update(task, changedTaskFields(original, input));
    }
    onClose();
  }

  const editing = state?.mode === "edit" || (state === null && original !== undefined);
  const canSubmit = values.title.trim().length > 0;

  return (
    <Sheet
      open={state !== null && !vanished}
      onClose={onClose}
      title={editing ? taskCopy.editTask : taskCopy.newTask}
      size="lg"
      bodyClassName="lg:p-0"
      footer={
        desktop ? (
          <>
            {editing && task && (
              <Button
                variant="danger-ghost"
                size="compact"
                icon={TrashIcon}
                onClick={() => onDelete(task)}
                className="mr-auto"
              >
                {taskCopy.deleteTask}
              </Button>
            )}
            <Button variant="secondary" size="compact" onClick={onClose}>
              {actionLabels.cancel}
            </Button>
            <Button type="submit" form={formId} size="compact" disabled={!canSubmit}>
              {editing ? actionLabels.save : taskCopy.addTask}
            </Button>
          </>
        ) : (
          <Button type="submit" form={formId} size="lg" disabled={!canSubmit} className="w-full">
            {editing ? actionLabels.save : taskCopy.addTask}
          </Button>
        )
      }
    >
      <TaskForm
        formId={formId}
        values={values}
        onChange={change}
        titleError={titleError}
        autoFocusTitle={!editing}
        autoFocusRepeat={focusRepeat}
        members={members}
        timeZone={household.timeZone}
        today={today}
        weekStartsOn={household.weekStartsOn}
        rotationOrder={household.rotationOrder}
        desktop={desktop}
        onSubmit={submit}
        onDelete={editing && task ? () => onDelete(task) : undefined}
      />
    </Sheet>
  );
}
