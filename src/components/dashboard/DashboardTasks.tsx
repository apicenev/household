import { CheckIcon } from "@heroicons/react/16/solid";
import { ExclamationCircleIcon, PlusIcon } from "@heroicons/react/20/solid";
import { CheckBadgeIcon } from "@heroicons/react/24/outline";
import type { ReactNode } from "react";
import type { TodayState } from "../../domain/dashboard";
import { isRecurring } from "../../domain/tasks";
import { actions, activityCopy, dashboardCopy, taskCopy, terms } from "../../lib/copy";
import { cx } from "../../lib/cx";
import { recentTimeLabel } from "../../lib/format";
import { describeRule } from "../../lib/recurrenceFormat";
import type { Member, Task } from "../../types";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { InlineAlert } from "../ui/InlineAlert";
import { PriorityMarker } from "../ui/PriorityMarker";
import { TaskAssigneeAvatar, TaskDueLabel, TaskRepeatMeta } from "../tasks/TaskParts";
import { DashboardSection, EmptyLine, SectionLink } from "./DashboardParts";

/** «Überfällig», «Heute» and «Kürzlich erledigt» on Start (`Dashboard.dc.html`, D67–D73). */

interface RowContext {
  today: string;
  timeZone: string;
  desktop: boolean;
  memberById: (uid: string) => Member | undefined;
  /** Ticked locally, completion not written yet (700 ms window, B5). */
  checking: ReadonlySet<string>;
  onToggle: (taskId: string) => void;
  /** «Aufgabe bearbeiten» (D73). */
  onOpen: (taskId: string) => void;
}

function DashboardTaskRow({
  task,
  overdue,
  first,
  ctx,
}: {
  task: Task;
  overdue: boolean;
  first: boolean;
  ctx: RowContext;
}) {
  const { desktop, today, timeZone } = ctx;
  const checking = ctx.checking.has(task.id);
  const assignee = task.assigneeId ? ctx.memberById(task.assigneeId) : undefined;
  const rule = isRecurring(task) ? describeRule(task.recurrence, { short: true }) : undefined;

  // Overdue rows show the due date (and rule); «Heute» shows the assignee on phones (D73).
  let meta: ReactNode = null;
  if (overdue) {
    meta = (
      <>
        <TaskDueLabel dueDate={task.dueDate} today={today} timeZone={timeZone} />
        {rule && (
          <span className="inline-flex items-center gap-1">
            · <TaskRepeatMeta repeat={{ rule }} />
          </span>
        )}
      </>
    );
  } else if (!assignee) {
    meta = terms.unassigned;
  } else if (!desktop) {
    meta = assignee.displayName;
  }

  return (
    <li
      onClick={() => ctx.onOpen(task.id)}
      className={cx(
        "relative flex cursor-pointer items-center gap-2",
        desktop
          ? cx(
              "pr-5 pl-2 hovered:bg-sunken",
              overdue ? "min-h-15 py-1" : "min-h-14 border-t border-line py-0.5",
            )
          : "min-h-15 py-1.5 pr-3.5 pl-1",
      )}
    >
      {!desktop && !first && (
        <span aria-hidden="true" className="absolute top-0 right-0 left-13 h-px bg-line" />
      )}
      <Checkbox
        checked={checking}
        onChange={() => ctx.onToggle(task.id)}
        onClick={(event) => event.stopPropagation()}
        aria-label={taskCopy.checkLabel(task.title)}
        overdue={overdue}
        size={desktop ? "sm" : "md"}
      />
      {/* The click bubbles to the row; the button makes it reachable by keyboard. */}
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 text-left focus-visible:outline-offset-2"
      >
        <span
          className={cx(
            "font-medium transition-colors duration-(--duration-base)",
            desktop ? "text-[15px] leading-[21px]" : "text-body leading-[22px]",
            checking ? "text-ink-subtle line-through" : "text-ink",
          )}
        >
          {task.title}
        </span>
        {meta && (
          <span className="flex flex-wrap items-center gap-x-1.5 text-[13px] leading-[18px] text-ink-muted tabular-nums">
            {meta}
          </span>
        )}
      </button>
      {task.priority === "high" && <PriorityMarker priority="high" size="row" />}
      {assignee && <TaskAssigneeAvatar member={assignee} />}
    </li>
  );
}

export function OverdueSection({ tasks, ctx }: { tasks: Task[]; ctx: RowContext }) {
  if (tasks.length === 0) return null;
  return (
    <DashboardSection
      title={terms.overdue}
      icon={ExclamationCircleIcon}
      tone="danger"
      desktop={ctx.desktop}
    >
      <ul className={ctx.desktop ? "pb-1" : undefined}>
        {tasks.map((task, index) => (
          <DashboardTaskRow key={task.id} task={task} overdue first={index === 0} ctx={ctx} />
        ))}
      </ul>
    </DashboardSection>
  );
}

export function TodaySection({
  tasks,
  state,
  allDone,
  onAddTask,
  error,
  onRetry,
  ctx,
}: {
  tasks: Task[];
  state: TodayState;
  /** D68 text for «Alles erledigt». */
  allDone: { mobile: string; desktop: string };
  onAddTask: () => void;
  error: boolean;
  onRetry: () => void;
  ctx: RowContext;
}) {
  const { desktop } = ctx;
  let body: ReactNode;
  if (error) {
    body = (
      <InlineAlert
        tone="danger"
        action={{ label: actions.retry, onClick: onRetry }}
        className="m-3"
      >
        {taskCopy.loadError}
      </InlineAlert>
    );
  } else if (state === "open") {
    body = (
      <ul>
        {tasks.map((task, index) => (
          <DashboardTaskRow
            key={task.id}
            task={task}
            overdue={false}
            first={index === 0}
            ctx={ctx}
          />
        ))}
      </ul>
    );
  } else if (state === "allDone") {
    const text = desktop ? allDone.desktop : allDone.mobile;
    body = (
      <div
        className={cx(
          "flex flex-col items-center text-center",
          desktop ? "gap-2 px-5 pt-5 pb-7" : "gap-2.5 px-5 py-7",
        )}
      >
        <div
          className={cx(
            "flex items-center justify-center rounded-pill bg-brand-soft text-brand",
            desktop ? "size-12" : "size-13",
          )}
        >
          <CheckBadgeIcon aria-hidden="true" className={desktop ? "size-6.5" : "size-7"} />
        </div>
        <p className={cx("font-semibold text-ink", desktop ? "text-body" : "text-heading")}>
          {dashboardCopy.allDone}
        </p>
        {text && (
          <p
            className={cx(
              "text-ink-muted",
              desktop ? "max-w-60 text-body-sm" : "max-w-65 text-[15px] leading-[22px]",
            )}
          >
            {text}
          </p>
        )}
        {!desktop && (
          <Button
            variant="secondary"
            size="compact"
            icon={PlusIcon}
            onClick={onAddTask}
            className="mt-1"
          >
            {dashboardCopy.addTask}
          </Button>
        )}
      </div>
    );
  } else {
    body = <EmptyLine desktop={desktop}>{dashboardCopy.nothingToday}</EmptyLine>;
  }

  return (
    <DashboardSection
      title={terms.today}
      count={
        error
          ? undefined
          : tasks.length > 0
            ? dashboardCopy.openCount(tasks.length)
            : dashboardCopy.todayDone
      }
      action={<SectionLink to="/tasks">{dashboardCopy.allTasks}</SectionLink>}
      desktop={desktop}
    >
      {body}
    </DashboardSection>
  );
}

/** «?» on sunken for someone no longer in the household (D82). */
function FormerMemberAvatar({ size }: { size: 30 | 32 }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-pill bg-sunken font-[650] text-ink-muted",
        size === 30 ? "size-7.5 text-[11px]" : "size-8 text-caption",
      )}
    >
      ?
    </span>
  );
}

export function RecentSection({
  tasks,
  now,
  timeZone,
  desktop,
  memberById,
}: {
  tasks: (Task & { completedAt: Date })[];
  now: Date;
  timeZone: string;
  desktop: boolean;
  memberById: (uid: string) => Member | undefined;
}) {
  const size = desktop ? 30 : 32;
  return (
    <DashboardSection
      title={terms.recentlyDone}
      action={<SectionLink to="/activity">{dashboardCopy.activity}</SectionLink>}
      desktop={desktop}
    >
      {tasks.length === 0 ? (
        <EmptyLine desktop={desktop}>{dashboardCopy.emptyRecent}</EmptyLine>
      ) : (
        <ul className={desktop ? "pb-2" : "py-1"}>
          {tasks.map((task) => {
            const member = task.completedBy ? memberById(task.completedBy) : undefined;
            const name = member?.displayName ?? activityCopy.formerMember;
            return (
              <li
                key={task.id}
                className={cx(
                  "flex items-center gap-3",
                  desktop ? "min-h-12 px-5 py-0.5" : "min-h-13 px-4 py-1",
                )}
              >
                <span className="relative shrink-0">
                  {member ? (
                    <Avatar initials={member.initials} color={member.avatarColor} size={size} />
                  ) : (
                    <FormerMemberAvatar size={size} />
                  )}
                  <span
                    aria-hidden="true"
                    className={cx(
                      "absolute -right-0.75 -bottom-0.75 flex items-center justify-center rounded-pill bg-brand text-on-brand ring-2 ring-surface",
                      desktop ? "size-3.75" : "size-4",
                    )}
                  >
                    <CheckIcon className={desktop ? "size-2.5" : "size-2.75"} />
                  </span>
                </span>
                <span
                  className={cx(
                    "min-w-0 flex-1 text-ink-muted",
                    desktop ? "text-body-sm" : "text-[15px] leading-[21px]",
                  )}
                >
                  <strong className="font-semibold text-ink">{name}</strong>{" "}
                  {dashboardCopy.doneVerb}{" "}
                  <span className="text-ink">{activityCopy.quoted(task.title)}</span>{" "}
                  {dashboardCopy.doneTail}
                </span>
                <span className="shrink-0 text-[13px] whitespace-nowrap text-ink-subtle tabular-nums">
                  {recentTimeLabel(task.completedAt, now, timeZone)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardSection>
  );
}

export type { RowContext as DashboardRowContext };
