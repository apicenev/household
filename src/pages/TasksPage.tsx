import { PlusIcon } from "@heroicons/react/20/solid";
import { CheckBadgeIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CompletedTaskRow, TaskRow } from "../components/tasks/TaskRow";
import { TaskDetailPanel } from "../components/tasks/TaskDetailPanel";
import {
  CompletedSection,
  TaskFilterBar,
  TaskGroupSection,
  TaskNoResults,
  type FilterOption,
} from "../components/tasks/TaskSections";
import { useTasks } from "../components/tasks/taskContext";
import { useCheckOff } from "../components/tasks/useCheckOff";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { InlineAlert } from "../components/ui/InlineAlert";
import { SkeletonList } from "../components/ui/Skeleton";
import { parseTaskFilters, taskFiltersToParams } from "../domain/taskFilters";
import {
  filterTasks,
  groupOpenTasks,
  hasFilters,
  isRecurring,
  recentlyCompleted,
  taskSummary,
  type TaskFilters,
} from "../domain/tasks";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { useToday } from "../hooks/useToday";
import { useAuth } from "../lib/auth/useAuth";
import { actions as actionLabels, areas, taskCopy } from "../lib/copy";
import { useLoadedHousehold } from "../lib/household/useHousehold";
import { describeRule, rotationLabel } from "../lib/recurrenceFormat";
import type { Task } from "../types";
import type { TaskRepeatInfo } from "../components/tasks/TaskParts";

/**
 * /tasks «Aufgaben» (`Tasks.dc.html`): filter chips (in the URL), the open tasks grouped
 * Überfällig / Heute / Demnächst / Ohne Datum, «Erledigt (n)». Desktop adds the summary,
 * «Neue Aufgabe» and the detail panel.
 */
export default function TasksPage() {
  const { household, members, tasks, tasksLoading, tasksError, retryTasks, memberById } =
    useLoadedHousehold();
  const { user } = useAuth();
  const { actions, openNewTask, openEditTask, confirmDelete } = useTasks();
  const desktop = useIsDesktop();
  const today = useToday(household.timeZone);
  const [params, setParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { checking, toggle } = useCheckOff(tasks, actions);
  useDocumentTitle(areas.tasks);

  const uid = user?.uid ?? "";
  const memberIds = household.memberIds;
  const filters = useMemo(() => parseTaskFilters(params, memberIds), [params, memberIds]);
  const filtered = hasFilters(filters);

  function setFilters(next: TaskFilters) {
    // replace: back leaves the page instead of undoing chip taps (B3).
    setParams(taskFiltersToParams(next, params), { replace: true });
  }

  const ctx = { today, weekStartsOn: household.weekStartsOn, memberIds };
  const groups = groupOpenTasks(filterTasks(tasks, filters, ctx), today);
  const visibleOpen = groups.flatMap((group) => group.tasks);
  const now = new Date();
  const completed = recentlyCompleted(tasks, now);
  const summary = taskSummary(tasks, today);
  const hasOpenTasks = summary.open > 0;

  // D19: the selected task, or the first one of the filtered list.
  const selected = desktop
    ? (visibleOpen.find((task) => task.id === selectedId) ?? visibleOpen[0])
    : undefined;

  // Row meta of a recurring task: «Wöchentlich» · «Nevio → Anna» (Phase 4 B10).
  const repeatInfo = (task: Task): TaskRepeatInfo | undefined =>
    isRecurring(task)
      ? {
          rule: describeRule(task.recurrence, { short: true }),
          rotation: task.rotation
            ? rotationLabel(task.rotation, (memberId) => memberById(memberId)?.displayName)
            : undefined,
        }
      : undefined;

  const toggleAssignee = (value: string) =>
    setFilters({ ...filters, assignee: filters.assignee === value ? undefined : value });
  const toggleDue = (value: NonNullable<TaskFilters["due"]>) =>
    setFilters({ ...filters, due: filters.due === value ? undefined : value });

  const firstName = (name: string) => name.split(/\s+/)[0] ?? name;
  const filterOptions: FilterOption[] = [
    {
      key: "mine",
      label: taskCopy.filters.mine,
      selected: filters.assignee === uid,
      onToggle: () => toggleAssignee(uid),
    },
    ...members
      .filter((member) => member.uid !== uid)
      .map((member) => ({
        key: `member-${member.uid}`,
        label: firstName(member.displayName),
        selected: filters.assignee === member.uid,
        onToggle: () => toggleAssignee(member.uid),
      })),
    {
      key: "unassigned",
      label: taskCopy.filters.unassigned,
      selected: filters.assignee === "none",
      onToggle: () => toggleAssignee("none"),
    },
    {
      key: "overdue",
      label: taskCopy.filters.overdue,
      selected: filters.due === "overdue",
      onToggle: () => toggleDue("overdue"),
    },
    {
      key: "today",
      label: taskCopy.filters.today,
      selected: filters.due === "today",
      onToggle: () => toggleDue("today"),
    },
    {
      key: "week",
      label: taskCopy.filters.week,
      selected: filters.due === "week",
      onToggle: () => toggleDue("week"),
    },
    {
      key: "none",
      label: taskCopy.filters.noDate,
      selected: filters.due === "none",
      onToggle: () => toggleDue("none"),
    },
    {
      key: "high",
      label: taskCopy.filters.highPriority,
      selected: filters.priority === "high",
      onToggle: () =>
        setFilters({ ...filters, priority: filters.priority === "high" ? undefined : "high" }),
    },
  ];

  const newTask = () => openNewTask({ onCreated: (id) => setSelectedId(id) });

  function list() {
    if (tasksError) {
      return (
        <InlineAlert tone="danger" action={{ label: actionLabels.retry, onClick: retryTasks }}>
          {taskCopy.loadError}
        </InlineAlert>
      );
    }
    if (tasksLoading) return <SkeletonList rows={4} />;

    return (
      <>
        {groups.length === 0 &&
          (filtered && hasOpenTasks ? (
            <TaskNoResults onReset={() => setFilters({})} />
          ) : (
            <EmptyState
              icon={tasks.length > 0 ? CheckBadgeIcon : CheckCircleIcon}
              title={tasks.length > 0 ? taskCopy.allDone : taskCopy.noneYet}
              text={tasks.length > 0 ? taskCopy.allDoneText : taskCopy.noneYetText}
              action={
                <Button size="compact" icon={PlusIcon} onClick={newTask}>
                  {taskCopy.addTask}
                </Button>
              }
            />
          ))}
        {groups.map(({ group, tasks: groupTasks }) => (
          <TaskGroupSection
            key={group}
            label={taskCopy.groups[group]}
            count={groupTasks.length}
            danger={group === "overdue"}
          >
            {groupTasks.map((task, index) => (
              <TaskRow
                key={task.id}
                task={task}
                assignee={task.assigneeId ? memberById(task.assigneeId) : undefined}
                today={today}
                timeZone={household.timeZone}
                desktop={desktop}
                checking={checking.has(task.id)}
                onToggle={() => toggle(task.id)}
                onOpen={desktop ? () => setSelectedId(task.id) : () => openEditTask(task.id)}
                selected={selected?.id === task.id}
                hideDue={group === "today"}
                repeat={repeatInfo(task)}
                first={index === 0}
              />
            ))}
          </TaskGroupSection>
        ))}
        {completed.length > 0 && (
          <CompletedSection count={completed.length}>
            {completed.map((task, index) => (
              <CompletedTaskRow
                key={task.id}
                task={task}
                completer={task.completedBy ? memberById(task.completedBy) : undefined}
                now={now}
                timeZone={household.timeZone}
                desktop={desktop}
                onReopen={() => actions.reopen(task)}
                first={index === 0}
              />
            ))}
          </CompletedSection>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3 lg:gap-5">
      {/* Phones show «Aufgaben» in the top bar; the h1 stays for screen readers. */}
      <header className="sr-only lg:not-sr-only lg:flex lg:items-end lg:justify-between lg:gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[40px] leading-[46px] font-medium tracking-[-0.015em] text-ink">
            {areas.tasks}
          </h1>
          {!tasksLoading && !tasksError && (
            <p className="text-[15px] text-ink-muted">
              {taskCopy.summary(summary.open, summary.overdue, summary.today)}
            </p>
          )}
        </div>
        <Button size="compact" icon={PlusIcon} onClick={newTask} className="hidden lg:flex">
          {taskCopy.newTask}
        </Button>
      </header>

      <TaskFilterBar options={filterOptions} onReset={() => setFilters({})} showReset={filtered} />

      <div
        className={
          selected
            ? "flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start"
            : "flex flex-col gap-5"
        }
      >
        <div className="flex min-w-0 flex-col gap-5">{list()}</div>
        {selected && (
          <TaskDetailPanel
            task={selected}
            assignee={selected.assigneeId ? memberById(selected.assigneeId) : undefined}
            today={today}
            timeZone={household.timeZone}
            weekStartsOn={household.weekStartsOn}
            memberIds={memberIds}
            memberById={memberById}
            onEdit={() => openEditTask(selected.id)}
            onDelete={() => confirmDelete(selected)}
          />
        )}
      </div>
    </div>
  );
}
