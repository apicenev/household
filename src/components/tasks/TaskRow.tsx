import { useDelayedFlag } from "../../hooks/useDelayedFlag";
import { dueGroup } from "../../domain/tasks";
import { completedLabel } from "../../lib/format";
import { taskCopy } from "../../lib/copy";
import { cx } from "../../lib/cx";
import type { Member, Task } from "../../types";
import { Checkbox } from "../ui/Checkbox";
import { PriorityMarker } from "../ui/PriorityMarker";
import { TaskAssigneeAvatar, TaskDueLabel } from "./TaskParts";

/** «Sync läuft» shows only after a write has been pending this long (B14). */
export const SYNC_RING_DELAY_MS = 1000;

export interface TaskRowProps {
  task: Task;
  assignee: Member | undefined;
  today: string;
  timeZone: string;
  desktop: boolean;
  /** Ticked locally, completion not written yet (the 700 ms window, B6). */
  checking: boolean;
  onToggle: () => void;
  /** Phones: opens «Aufgabe bearbeiten» (D18). Desktop: selects the row (D19). */
  onOpen?: () => void;
  selected?: boolean;
  /** Phones hide the date in the «Heute» group (B11). */
  hideDue?: boolean;
  first: boolean;
}

/**
 * An open task (`Tasks.dc.html`). Phones: 60 px, title with a meta line, priority and avatar
 * on the right. Desktop: 56 px, title left, date and priority columns, avatar; the row
 * selects the task for the detail panel.
 */
export function TaskRow({
  task,
  assignee,
  today,
  timeZone,
  desktop,
  checking,
  onToggle,
  onOpen,
  selected = false,
  hideDue = false,
  first,
}: TaskRowProps) {
  const syncing = useDelayedFlag(task.hasPendingWrites, SYNC_RING_DELAY_MS);
  const overdue = dueGroup(task.dueDate, today) === "overdue";

  const title = (
    <span
      className={cx(
        "min-w-0 font-medium transition-colors duration-(--duration-base)",
        desktop ? "truncate text-[15px]" : "text-body leading-[22px]",
        checking ? "text-ink-subtle line-through" : "text-ink",
      )}
    >
      {task.title}
    </span>
  );

  return (
    <li
      onClick={onOpen}
      className={cx(
        "relative flex items-center",
        desktop
          ? "min-h-14 gap-2.5 border-t border-line py-1 pr-3 pl-2 hovered:bg-sunken"
          : "min-h-15 gap-2 py-1.5 pr-3.5 pl-1",
        onOpen && "cursor-pointer",
        selected && "bg-brand-soft shadow-[inset_3px_0_0_var(--color-brand)] hovered:bg-brand-soft",
      )}
    >
      {!desktop && !first && (
        <span aria-hidden="true" className="absolute top-0 right-0 left-13 h-px bg-line" />
      )}
      <Checkbox
        checked={checking}
        onChange={onToggle}
        onClick={(event) => event.stopPropagation()}
        aria-label={taskCopy.checkLabel(task.title)}
        overdue={overdue}
        syncing={syncing}
        size={desktop ? "sm" : "md"}
      />
      {desktop ? (
        <>
          <button
            type="button"
            aria-current={selected || undefined}
            className="flex min-w-0 flex-1 cursor-pointer text-left focus-visible:outline-offset-4"
          >
            {title}
          </button>
          <span className="flex shrink-0 items-center gap-3.5 text-[13px] text-ink-muted">
            <TaskDueLabel
              dueDate={task.dueDate}
              today={today}
              timeZone={timeZone}
              className="min-w-23"
            />
            <span className="flex min-w-12">
              <PriorityMarker priority={task.priority} size="row" />
            </span>
          </span>
        </>
      ) : (
        <button
          type="button"
          tabIndex={onOpen ? undefined : -1}
          className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 py-0.5 text-left focus-visible:outline-offset-2"
        >
          {title}
          {!hideDue && task.dueDate !== null && (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[18px] text-ink-muted">
              <TaskDueLabel dueDate={task.dueDate} today={today} timeZone={timeZone} />
            </span>
          )}
        </button>
      )}
      {!desktop && <PriorityMarker priority={task.priority} size="row" />}
      <TaskAssigneeAvatar member={assignee} />
    </li>
  );
}

export interface CompletedTaskRowProps {
  task: Task;
  completer: Member | undefined;
  now: Date;
  timeZone: string;
  desktop: boolean;
  onReopen: () => void;
  first: boolean;
}

/** A row in «Erledigt (n)»: filled checkbox reopens, «{Name} · {Gestern}» (B5). */
export function CompletedTaskRow({
  task,
  completer,
  now,
  timeZone,
  desktop,
  onReopen,
  first,
}: CompletedTaskRowProps) {
  const syncing = useDelayedFlag(task.hasPendingWrites, SYNC_RING_DELAY_MS);
  const meta = [
    completer?.displayName,
    task.completedAt ? completedLabel(task.completedAt, now, timeZone) : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li
      className={cx(
        "relative flex items-center",
        desktop
          ? "min-h-13 gap-2.5 border-t border-line py-0.5 pr-3 pl-2"
          : "min-h-14 gap-2 py-1 pr-3.5 pl-1",
      )}
    >
      {!desktop && !first && (
        <span aria-hidden="true" className="absolute top-0 right-0 left-13 h-px bg-line" />
      )}
      <Checkbox
        checked
        onChange={onReopen}
        aria-label={taskCopy.reopenLabel(task.title)}
        syncing={syncing}
        size={desktop ? "sm" : "md"}
      />
      {desktop ? (
        <>
          <span className="min-w-0 flex-1 truncate text-[15px] text-ink-subtle line-through">
            {task.title}
          </span>
          <span className="shrink-0 text-[13px] text-ink-muted">{meta}</span>
        </>
      ) : (
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body leading-[22px] text-ink-subtle line-through">
            {task.title}
          </span>
          <span className="text-[13px] leading-[18px] text-ink-muted">{meta}</span>
        </span>
      )}
      {completer && <TaskAssigneeAvatar member={completer} />}
    </li>
  );
}
