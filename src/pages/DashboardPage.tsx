import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardSkeleton } from "../components/dashboard/DashboardParts";
import { ShoppingSection, UpcomingSection } from "../components/dashboard/DashboardLists";
import {
  OverdueSection,
  RecentSection,
  TodaySection,
  type DashboardRowContext,
} from "../components/dashboard/DashboardTasks";
import { allDoneText, dashboardSummary } from "../components/dashboard/dashboardLabels";
import { useQuickAdd } from "../components/layout/quickAddContext";
import { useShopping } from "../components/shopping/shoppingContext";
import { useItemCheckOff } from "../components/shopping/useItemCheckOff";
import { useTasks } from "../components/tasks/taskContext";
import { useCheckOff } from "../components/tasks/useCheckOff";
import { Avatar } from "../components/ui/Avatar";
import {
  lastCompleted,
  nextDueTask,
  overdueTasks,
  shoppingPreview,
  todayState,
  todayTasks,
  upcomingWeek,
} from "../domain/dashboard";
import { greeting } from "../domain/greeting";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { useNow } from "../hooks/useNow";
import { useToday } from "../hooks/useToday";
import { areas } from "../lib/copy";
import { cx } from "../lib/cx";
import { formatLongDate } from "../lib/format";
import { useLoadedHousehold } from "../lib/household/useHousehold";

/**
 * /dashboard «Start» (`Dashboard.dc.html`, DSH-01…07, DSH-09; Phase 8 B4–B8, D67–D75): date,
 * greeting and summary, then «Überfällig» (only if non-empty), «Heute», «Einkauf»,
 * «Demnächst» and «Kürzlich erledigt», all from the live data of the HouseholdProvider. Phones
 * stack the sections; desktop puts them in three columns.
 */
export default function DashboardPage() {
  const household = useLoadedHousehold();
  const {
    household: { timeZone, weekStartsOn },
    me,
    members,
    memberById,
    tasks,
    tasksLoading,
    tasksError,
    retryTasks,
    items,
    itemsLoading,
    itemsError,
    retryItems,
    events,
    eventsLoading,
    eventsError,
    retryEvents,
  } = household;
  const { actions: taskActions, openEditTask, openNewTask } = useTasks();
  const { actions: shoppingActions, openEditItem } = useShopping();
  const quickAdd = useQuickAdd();
  const navigate = useNavigate();
  const desktop = useIsDesktop();
  const now = useNow();
  const today = useToday(timeZone);
  const taskCheck = useCheckOff(tasks, taskActions);
  const itemCheck = useItemCheckOff(items, shoppingActions);
  useDocumentTitle(areas.dashboard);

  // D74: the skeleton until each list has loaded or failed.
  const loading =
    (tasksLoading && !tasksError) ||
    (itemsLoading && !itemsError) ||
    (eventsLoading && !eventsError);

  const overdue = useMemo(() => overdueTasks(tasks, today), [tasks, today]);
  const dueToday = useMemo(() => todayTasks(tasks, today), [tasks, today]);
  const state = useMemo(() => todayState(tasks, today), [tasks, today]);
  const next = useMemo(() => nextDueTask(tasks, today), [tasks, today]);
  const recent = useMemo(() => lastCompleted(tasks), [tasks]);
  const shopping = useMemo(() => shoppingPreview(items), [items]);
  // `today` keeps it fresh across midnight; within a day, past events drop out on the next tick.
  const upcomingRows = useMemo(
    () => upcomingWeek(events, now, timeZone, weekStartsOn),
    [events, now, timeZone, weekStartsOn],
  );

  const summary = dashboardSummary({
    tasks: tasksLoading || tasksError ? null : overdue.length + dueToday.length,
    items: itemsLoading || itemsError ? null : shopping.openCount,
    events: eventsLoading || eventsError ? null : upcomingRows.length,
  });
  const firstName = (me?.displayName ?? "").trim().split(/\s+/)[0];

  const rowContext: DashboardRowContext = {
    today,
    timeZone,
    desktop,
    memberById,
    checking: taskCheck.checking,
    onToggle: taskCheck.toggle,
    onOpen: openEditTask,
  };

  const header = (
    <div className={cx("flex flex-col gap-1", !desktop && "px-1")}>
      <span className="text-body-sm font-medium text-ink-muted">
        {formatLongDate(now, timeZone)}
      </span>
      <h1
        className={cx(
          "font-display text-ink",
          desktop ? "text-[40px] leading-[46px] font-medium tracking-[-0.015em]" : "text-display",
        )}
      >
        {firstName ? `${greeting(now, timeZone)}, ${firstName}` : greeting(now, timeZone)}
      </h1>
      {!loading && summary && (
        <p className={cx("text-[15px] text-ink-muted", !desktop && "leading-[22px]")}>{summary}</p>
      )}
    </div>
  );

  const overdueSection = tasksError ? null : <OverdueSection tasks={overdue} ctx={rowContext} />;
  const todaySection = (
    <TodaySection
      tasks={dueToday}
      state={state}
      allDone={allDoneText(members.length, next, today)}
      onAddTask={() => openNewTask({ prefill: { dueDate: today } })}
      error={tasksError !== null}
      onRetry={retryTasks}
      ctx={rowContext}
    />
  );
  // On a task error the alert sits in «Heute»; «Kürzlich erledigt» has nothing to show.
  const recentSection = tasksError ? null : (
    <RecentSection
      tasks={recent}
      now={now}
      timeZone={timeZone}
      desktop={desktop}
      memberById={memberById}
    />
  );
  const shoppingSection = (
    <ShoppingSection
      items={shopping.items}
      openCount={shopping.openCount}
      desktop={desktop}
      checking={itemCheck.checking}
      onToggle={itemCheck.toggle}
      onOpen={openEditItem}
      onAdd={() => quickAdd.open("item")}
      error={itemsError !== null}
      onRetry={retryItems}
    />
  );
  const upcomingSection = (
    <UpcomingSection
      rows={upcomingRows}
      today={today}
      timeZone={timeZone}
      members={members}
      desktop={desktop}
      onOpen={(key) => navigate(`/calendar?${new URLSearchParams({ event: key })}`)}
      error={eventsError !== null}
      onRetry={retryEvents}
    />
  );

  if (desktop) {
    return (
      <div className="flex flex-col gap-7">
        <div className="flex items-end justify-between gap-6">
          {header}
          <span className="flex shrink-0 items-center">
            {members.map((member, index) => (
              <Avatar
                key={member.uid}
                initials={member.initials}
                color={member.avatarColor}
                size={32}
                name={member.displayName}
                className={cx("ring-2 ring-canvas", index > 0 && "-ml-2")}
              />
            ))}
          </span>
        </div>
        {loading ? (
          <DashboardSkeleton desktop />
        ) : (
          <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)] items-start gap-5">
            <div className="flex flex-col gap-5">
              {overdueSection}
              {todaySection}
              {recentSection}
            </div>
            {shoppingSection}
            {upcomingSection}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}
      {loading ? (
        <DashboardSkeleton desktop={false} />
      ) : (
        <>
          {overdueSection}
          {todaySection}
          {shoppingSection}
          {upcomingSection}
          {recentSection}
        </>
      )}
    </div>
  );
}
