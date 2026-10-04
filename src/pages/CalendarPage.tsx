import { PencilIcon, TrashIcon } from "@heroicons/react/16/solid";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon as Pencil20,
  PlusIcon,
  TrashIcon as Trash20,
} from "@heroicons/react/20/solid";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCalendar } from "../components/calendar/calendarContext";
import { DayPanel } from "../components/calendar/DayPanel";
import { DesktopEventCard, MobileEventCard } from "../components/calendar/EventCard";
import { EventDetail } from "../components/calendar/EventDetail";
import { MonthGrid } from "../components/calendar/MonthGrid";
import { UpcomingList } from "../components/calendar/UpcomingList";
import { useCalendarParams } from "../components/calendar/useCalendarParams";
import { Button } from "../components/ui/Button";
import { eventCategories } from "../components/ui/categories";
import { CategoryLabel } from "../components/ui/CategoryLabel";
import { IconButton } from "../components/ui/IconButton";
import { InlineAlert } from "../components/ui/InlineAlert";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { useToast } from "../components/ui/toastContext";
import {
  addMonths,
  eventsOnDay,
  monthGrid,
  occurrenceDays,
  occurrencesInRange,
  upcoming,
  UPCOMING_DAYS,
  type CalendarView,
} from "../domain/calendar";
import { addDaysToKey } from "../domain/dateKeys";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { useToday } from "../hooks/useToday";
import { actions as actionLabels, areas, calendarCopy } from "../lib/copy";
import { formatMonthYear } from "../lib/format";
import { useLoadedHousehold } from "../lib/household/useHousehold";
import type { CalendarEvent, EventCategory, EventOccurrence } from "../types";

const LEGEND = Object.keys(eventCategories) as EventCategory[];

/**
 * /calendar «Kalender» (`Calendar.dc.html`, CAL-01…03, CAL-08): tabs «Monat» / «Demnächst»,
 * the month grid with the selected day below (phones) or in the right column (desktop), and
 * on phones the Termin-Detail behind `?event=` (D45). State lives in the URL (B8). «Neuer
 * Termin» / «Termin hinzufügen», «Bearbeiten» and «Löschen» go through CalendarProvider.
 */
export default function CalendarPage() {
  const { household, members, events, eventsLoading, eventsError, retryEvents } =
    useLoadedHousehold();
  const timeZone = household.timeZone;
  const todayKey = useToday(timeZone);
  const desktop = useIsDesktop();
  const params = useCalendarParams(todayKey);
  const { month, selectedDay, view, eventId } = params;
  const toast = useToast();
  const calendar = useCalendar();
  const location = useLocation();
  const navigate = useNavigate();
  useDocumentTitle(areas.calendar);

  const weeks = monthGrid(month, household.weekStartsOn, todayKey);
  const gridFirst = weeks[0][0].key;
  const gridLast = weeks[weeks.length - 1][6].key;
  const gridOccurrences = occurrencesInRange(events, gridFirst, gridLast, timeZone);
  const dayOccurrences = eventsOnDay(gridOccurrences, selectedDay, timeZone);

  // `?event=`: the event behind it, and whether it was there before (deleted elsewhere, D52).
  const linked = eventId ? events.find((event) => event.id === eventId) : undefined;
  const linkedOccurrence: EventOccurrence | null = linked
    ? { key: linked.id, event: linked, start: linked.start, end: linked.end }
    : null;
  const seenId = useRef<string | null>(null);
  const { clearEvent, showEventDay } = params;
  // Desktop: `?event=` is the expanded card (B8); it must be one of the selected day's.
  const expandedKey = desktop ? eventId : null;
  const linkedOnSelectedDay = dayOccurrences.some((occurrence) => occurrence.key === eventId);

  useEffect(() => {
    if (!eventId || eventsLoading) return;
    if (!linked) {
      if (seenId.current === eventId && !calendar.deletedHere(eventId)) {
        toast.show({ message: calendarCopy.deletedElsewhere, tone: "info" });
      }
      seenId.current = null;
      clearEvent();
      return;
    }
    seenId.current = linked.id;
    if (desktop && !linkedOnSelectedDay) {
      // A phone link or a resized window: show the event's day with its card open (B8).
      const occurrence = { key: linked.id, event: linked, start: linked.start, end: linked.end };
      showEventDay(occurrenceDays(occurrence, timeZone).startKey, linked.id);
    }
  }, [
    eventId,
    eventsLoading,
    linked,
    linkedOnSelectedDay,
    calendar,
    desktop,
    timeZone,
    toast,
    clearEvent,
    showEventDay,
  ]);

  function closeDetail() {
    // Back to where the detail was opened from; a deep link has no in-app history (B8).
    if (location.key !== "default") navigate(-1);
    else clearEvent();
  }

  /**
   * D53: confirm, then leave the detail (phones) or collapse the card (desktop) before the
   * delete goes out, so it doesn't count as «deleted elsewhere» (D52).
   */
  function leaveDeleted() {
    seenId.current = null;
    if (desktop) clearEvent();
    else closeDetail();
  }

  function remove(event: CalendarEvent) {
    calendar.confirmDelete(event, leaveDeleted);
  }

  function edit(event: CalendarEvent) {
    calendar.openEditEvent(event.id, leaveDeleted);
  }

  if (!desktop && eventId && (linkedOccurrence || eventsLoading)) {
    return (
      <EventDetail
        occurrence={linkedOccurrence}
        timeZone={timeZone}
        members={members}
        onBack={closeDetail}
        headerAction={
          linked && (
            <button
              type="button"
              onClick={() => edit(linked)}
              className="flex h-11 cursor-pointer items-center rounded-control px-3 text-body font-semibold text-brand-strong hovered:bg-brand-soft"
            >
              {actionLabels.edit}
            </button>
          )
        }
        footer={
          linked && (
            <div className="sticky bottom-0 mt-auto flex gap-2 border-t border-line bg-canvas px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+--spacing(3))]">
              <Button
                variant="secondary"
                size="lg"
                icon={Pencil20}
                onClick={() => edit(linked)}
                className="flex-1"
              >
                {actionLabels.edit}
              </Button>
              <Button
                variant="danger-ghost"
                size="lg"
                icon={Trash20}
                onClick={() => remove(linked)}
                className="flex-1"
              >
                {actionLabels.delete}
              </Button>
            </div>
          )
        }
      />
    );
  }

  const addEvent = (dayKey: string) => (
    <Button
      variant="ghost"
      size={desktop ? "sm" : "compact"}
      icon={PlusIcon}
      onClick={() => calendar.openNewEvent({ prefill: { dayKey } })}
    >
      {calendarCopy.addEvent}
    </Button>
  );

  function openOccurrence(occurrence: EventOccurrence, dayKey: string) {
    if (desktop) {
      showEventDay(dayKey, occurrence.event.id);
    } else {
      params.openEvent(occurrence.event.id);
    }
  }

  const upcomingGroups =
    view === "upcoming"
      ? upcoming(
          occurrencesInRange(events, todayKey, addDaysToKey(todayKey, UPCOMING_DAYS - 1), timeZone),
          new Date(),
          timeZone,
        )
      : [];

  const tabs = (
    <SegmentedControl<CalendarView>
      aria-label={calendarCopy.viewLabel}
      semantics="tabs"
      size={desktop ? "sm" : "md"}
      value={view}
      onChange={params.setView}
      options={[
        { value: "month", label: calendarCopy.month },
        { value: "upcoming", label: calendarCopy.upcoming },
      ]}
      className={desktop ? "w-55" : undefined}
    />
  );

  const errorAlert = eventsError && (
    <InlineAlert tone="danger" action={{ label: actionLabels.retry, onClick: retryEvents }}>
      {calendarCopy.loadError}
    </InlineAlert>
  );

  const [monthName, year] = splitMonth(month);
  const monthNav = (
    <>
      <IconButton
        aria-label={calendarCopy.prevMonth}
        icon={ChevronLeftIcon}
        iconSize={20}
        onClick={() => params.showMonth(addMonths(month, -1))}
      />
      <IconButton
        aria-label={calendarCopy.nextMonth}
        icon={ChevronRightIcon}
        iconSize={20}
        onClick={() => params.showMonth(addMonths(month, 1))}
      />
    </>
  );

  const grid = (
    <MonthGrid
      month={month}
      weeks={weeks}
      occurrences={gridOccurrences}
      selectedDay={selectedDay}
      todayKey={todayKey}
      weekStartsOn={household.weekStartsOn}
      timeZone={timeZone}
      desktop={desktop}
      loading={eventsLoading}
      onSelectDay={params.selectDay}
      onShowMonth={params.showMonth}
    />
  );

  const dayPanel = (
    <DayPanel
      dayKey={selectedDay}
      todayKey={todayKey}
      occurrences={dayOccurrences}
      loading={eventsLoading}
      desktop={desktop}
      emptyAction={addEvent(selectedDay)}
      renderCard={(occurrence) =>
        desktop ? (
          <DesktopEventCard
            key={occurrence.key}
            occurrence={occurrence}
            dayKey={selectedDay}
            timeZone={timeZone}
            members={members}
            open={expandedKey === occurrence.key}
            onToggle={() =>
              params.expandEvent(expandedKey === occurrence.key ? null : occurrence.event.id)
            }
            actions={
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={PencilIcon}
                  onClick={() => edit(occurrence.event)}
                >
                  {actionLabels.edit}
                </Button>
                <Button
                  variant="danger-ghost"
                  size="sm"
                  icon={TrashIcon}
                  onClick={() => remove(occurrence.event)}
                >
                  {actionLabels.delete}
                </Button>
              </>
            }
          />
        ) : (
          <MobileEventCard
            key={occurrence.key}
            occurrence={occurrence}
            dayKey={selectedDay}
            timeZone={timeZone}
            members={members}
            onOpen={() => params.openEvent(occurrence.event.id)}
          />
        )
      }
    />
  );

  const upcomingList = (
    <UpcomingList
      groups={upcomingGroups}
      todayKey={todayKey}
      timeZone={timeZone}
      members={members}
      desktop={desktop}
      emptyAction={addEvent(todayKey)}
      onOpen={openOccurrence}
    />
  );

  if (desktop) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="sr-only">{areas.calendar}</h1>
        <div className="flex items-center gap-3">
          <h2 className="min-w-62.5 font-display text-[36px] leading-10.5 font-medium tracking-[-0.015em]">
            {monthName} <span className="text-ink-muted">{year}</span>
          </h2>
          <div className="flex items-center gap-0.5">
            {monthNav}
            <button
              type="button"
              onClick={params.goToday}
              className="ml-1.5 h-9 cursor-pointer rounded-[10px] bg-surface px-3.5 text-body-sm font-semibold text-ink inset-ring inset-ring-line-strong hovered:bg-sunken"
            >
              {calendarCopy.today}
            </button>
          </div>
          <div className="flex-1" />
          {tabs}
          <Button
            size="compact"
            icon={PlusIcon}
            onClick={() => calendar.openNewEvent({ prefill: { dayKey: selectedDay } })}
          >
            {calendarCopy.newEvent}
          </Button>
        </div>
        {errorAlert}
        <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-5">
          {view === "month" ? (
            <div className="overflow-hidden rounded-card bg-surface shadow-card">{grid}</div>
          ) : (
            upcomingList
          )}
          {dayPanel}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Phones show «Kalender» in the top bar; the h1 stays for screen readers. */}
      <h1 className="sr-only">{areas.calendar}</h1>
      {tabs}
      {errorAlert}
      {view === "month" ? (
        <>
          <div className="rounded-card bg-surface px-2 pt-2 pb-2.5 shadow-card">
            <div className="flex items-center gap-0.5 pb-1 pl-2.5">
              <h2 className="flex-1 font-display text-[22px] leading-7 font-medium">
                {monthName} <span className="text-ink-muted">{year}</span>
              </h2>
              <button
                type="button"
                onClick={params.goToday}
                className="h-9 cursor-pointer rounded-[10px] bg-sunken px-3 text-body-sm font-semibold text-ink hovered:bg-line"
              >
                {calendarCopy.today}
              </button>
              {monthNav}
            </div>
            {grid}
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-line px-2 pt-2.5 pb-0.5">
              {LEGEND.map((category) => (
                <CategoryLabel key={category} kind="event" category={category} variant="legend" />
              ))}
            </div>
          </div>
          {dayPanel}
        </>
      ) : (
        upcomingList
      )}
    </div>
  );
}

/** «Oktober 2026» → ["Oktober", "2026"]; the year is shown muted. */
function splitMonth(month: string): [string, string] {
  const label = formatMonthYear(month);
  const space = label.lastIndexOf(" ");
  return [label.slice(0, space), label.slice(space + 1)];
}
