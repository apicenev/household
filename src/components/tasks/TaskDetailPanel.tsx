import { ArrowPathIcon, FlagIcon, TrashIcon } from "@heroicons/react/16/solid";
import { PencilIcon } from "@heroicons/react/20/solid";
import { dueGroup } from "../../domain/tasks";
import { actions, priorityLabels, taskCopy, terms } from "../../lib/copy";
import { cx } from "../../lib/cx";
import type { Member, Task } from "../../types";
import { Button } from "../ui/Button";
import { TaskAssigneeAvatar, TaskDueLabel } from "./TaskParts";

const priorityText = {
  low: "text-priority-low",
  medium: "text-priority-medium",
  high: "text-priority-high",
} as const;

/**
 * Desktop «Aufgabendetails» (`Tasks.dc.html`): title with «Bearbeiten», notes, Zuständig /
 * Fällig am / Priorität / Wiederholen, «Löschen». Rotation and «Diesmal überspringen» come
 * with Phase 4 / RTK-11.
 */
export function TaskDetailPanel({
  task,
  assignee,
  today,
  timeZone,
  onEdit,
  onDelete,
}: {
  task: Task;
  assignee: Member | undefined;
  today: string;
  timeZone: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const overdue = dueGroup(task.dueDate, today) === "overdue";
  return (
    <aside
      aria-label={taskCopy.details}
      className="sticky top-10 flex flex-col gap-4.5 rounded-card bg-surface p-5 shadow-card"
    >
      <div className="flex items-start gap-2.5">
        <h2 className="flex-1 font-display text-[24px] leading-[30px] font-medium break-words">
          {task.title}
        </h2>
        <button
          type="button"
          aria-label={taskCopy.editTask}
          onClick={onEdit}
          className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-sunken text-ink hovered:bg-line"
        >
          <PencilIcon aria-hidden="true" className="size-4.5" />
        </button>
      </div>
      {task.notes && (
        <p className="-mt-1.5 text-[15px] leading-[22px] whitespace-pre-line text-ink-muted">
          {task.notes}
        </p>
      )}
      <dl className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-x-3 gap-y-3.5 text-body-sm">
        <dt className="text-ink-muted">{terms.assignee}</dt>
        <dd className="flex items-center gap-2 font-medium">
          <TaskAssigneeAvatar member={assignee} size={26} />
          {assignee?.displayName ?? terms.unassigned}
        </dd>
        <dt className="text-ink-muted">{taskCopy.dueOn}</dt>
        <dd className={cx(!overdue && "text-ink")}>
          <TaskDueLabel dueDate={task.dueDate} today={today} timeZone={timeZone} />
        </dd>
        <dt className="text-ink-muted">{taskCopy.priority}</dt>
        <dd className={cx("flex items-center gap-1.5 font-semibold", priorityText[task.priority])}>
          <FlagIcon aria-hidden="true" className="size-4" />
          {priorityLabels[task.priority]}
        </dd>
        <dt className="text-ink-muted">{terms.repeat}</dt>
        <dd className="flex items-center gap-1.5 font-medium">
          <ArrowPathIcon aria-hidden="true" className="size-4 text-ink-muted" />
          {taskCopy.noRepeat}
        </dd>
      </dl>
      <div className="flex border-t border-line pt-3.5">
        <Button
          variant="danger-ghost"
          size="sm"
          icon={TrashIcon}
          onClick={onDelete}
          className="ml-auto"
        >
          {actions.delete}
        </Button>
      </div>
    </aside>
  );
}
