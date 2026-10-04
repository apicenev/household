import {
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowsRightLeftIcon,
  FlagIcon,
  TrashIcon,
} from "@heroicons/react/16/solid";
import { PencilIcon } from "@heroicons/react/20/solid";
import { Fragment } from "react";
import { rotationOrder } from "../../domain/rotation";
import { buildNextOccurrence, dueGroup, isRecurring } from "../../domain/tasks";
import { actions, priorityLabels, taskCopy, terms } from "../../lib/copy";
import { cx } from "../../lib/cx";
import { describeRule, rotationPreview } from "../../lib/recurrenceFormat";
import type { Member, Task, TaskRotation, WeekStart } from "../../types";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { TaskAssigneeAvatar, TaskDueLabel } from "./TaskParts";

const priorityText = {
  low: "text-priority-low",
  medium: "text-priority-medium",
  high: "text-priority-high",
} as const;

/**
 * Desktop «Aufgabendetails» (`Tasks.dc.html`): title with «Bearbeiten», notes, Zuständig /
 * Fällig am / Priorität / Wiederholen, the «Abwechseln» block of a rotating task (Phase 4,
 * D28), «Löschen». «Diesmal überspringen» stays hidden until RTK-11.
 */
export function TaskDetailPanel({
  task,
  assignee,
  today,
  timeZone,
  weekStartsOn,
  memberIds,
  memberById,
  onEdit,
  onDelete,
}: {
  task: Task;
  assignee: Member | undefined;
  today: string;
  timeZone: string;
  weekStartsOn: WeekStart;
  memberIds: readonly string[];
  memberById: (uid: string) => Member | undefined;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const overdue = dueGroup(task.dueDate, today) === "overdue";
  const recurring = isRecurring(task) ? task : undefined;
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
          <ArrowPathIcon aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
          {recurring ? describeRule(recurring.recurrence, { weekStartsOn }) : taskCopy.noRepeat}
        </dd>
      </dl>
      {recurring?.rotation && (
        <RotationBlock
          task={recurring}
          rotation={recurring.rotation}
          today={today}
          timeZone={timeZone}
          weekStartsOn={weekStartsOn}
          memberIds={memberIds}
          memberById={memberById}
        />
      )}
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

/**
 * «Abwechseln»: the members in order, the current one emphasised, and the preview «Diesen
 * Samstag Nevio, danach Anna am Sa., 10. Okt.» (`Tasks.dc.html`, D28). Former members are
 * left out.
 */
function RotationBlock({
  task,
  rotation,
  today,
  timeZone,
  weekStartsOn,
  memberIds,
  memberById,
}: {
  task: Task & { dueDate: string };
  rotation: TaskRotation;
  today: string;
  timeZone: string;
  weekStartsOn: WeekStart;
  memberIds: readonly string[];
  memberById: (uid: string) => Member | undefined;
}) {
  const order = rotationOrder(rotation)
    .map(memberById)
    .filter((member): member is Member => member !== undefined);
  const next = buildNextOccurrence(
    task,
    { today, weekStartsOn, memberIds },
    { advanceRotation: true },
  );
  const current = order[0];
  const nextMember = next.assigneeId ? memberById(next.assigneeId) : undefined;

  return (
    <div className="flex flex-col gap-2 rounded-control bg-sunken p-3.5">
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted">
        <ArrowsRightLeftIcon aria-hidden="true" className="size-4" />
        {taskCopy.rotation}
      </span>
      <ol className="flex flex-wrap items-center gap-2">
        {order.map((member, index) => (
          <Fragment key={member.uid}>
            {index > 0 && (
              <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0 text-ink-subtle" />
            )}
            <li
              className={cx(
                "flex h-8 items-center gap-1.5 rounded-pill bg-surface pr-2.5 pl-0.75 text-[14px] shadow-card",
                index === 0 ? "font-semibold text-ink" : "font-medium text-ink-muted",
              )}
            >
              <Avatar initials={member.initials} color={member.avatarColor} size={26} />
              {member.displayName}
            </li>
          </Fragment>
        ))}
      </ol>
      {current && nextMember && (
        <span className="text-[13px] text-ink-muted">
          {rotationPreview(
            { dueDate: task.dueDate, name: current.displayName },
            { dueDate: next.dueDate, name: nextMember.displayName },
            today,
            weekStartsOn,
            timeZone,
          )}
        </span>
      )}
    </div>
  );
}
