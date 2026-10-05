import { actorOf, rowEntry, type ActivityRow, type ActivitySubject } from "../../domain/activity";
import { isMultiDayAllDay, singleOccurrence } from "../../domain/calendar";
import { daysBetweenKeys } from "../../domain/dateKeys";
import { allDayKeys } from "../../domain/eventTime";
import { activityCopy, calendarCopy, terms } from "../../lib/copy";
import {
  formatDate,
  formatShortRange,
  formatTime,
  formatWeekdayLong,
  fromDateKey,
} from "../../lib/format";
import type { ActivityTargetType, CalendarEvent, Member } from "../../types";
import { participantNames, repeatLabel } from "../calendar/calendarLabels";
import { shopCategories } from "../ui/categories";

/**
 * The feed's visible text (`Activity.dc.html`, Phase 8 D77–D82). The stored snapshot title is
 * the row's subject (ACT-02); sub lines come from live data (D78).
 */

/** The small icon on the avatar (`Activity.dc.html`; `taskCreated` is D77). */
export type ActivityIconKind = "taskDone" | "taskCreated" | "assign" | "shop" | "event" | "member";

export interface ActivityLine {
  /** Bold actor name, «Ehemaliges Mitglied» for someone who left (D82). */
  who: string;
  verb: string;
  /** «Bad putzen» in «…» quotes, «4 Artikel», or the household name. */
  what: string;
  /** Rest of the sentence with its leading space, e.g. « erledigt». */
  tail: string;
  icon: ActivityIconKind;
  /** Type pill on desktop rows. */
  typeLabel: string;
  /** The whole sentence, for screen readers. */
  sentence: string;
}

export interface LineContext {
  members: readonly Member[];
  householdName: string;
}

const MAX_NAMES = 5;

function line(
  who: string,
  verb: string,
  what: string,
  tail: string,
  icon: ActivityIconKind,
  targetType: ActivityTargetType,
): ActivityLine {
  return {
    who,
    verb,
    what,
    tail,
    icon,
    typeLabel: activityCopy.typeLabels[targetType],
    sentence: `${who} ${verb} ${what}${tail}`,
  };
}

/** The actor's name, or the D82 placeholder. */
export function actorName(actorId: string, members: readonly Member[]): string {
  return actorOf(actorId, members)?.displayName ?? activityCopy.formerMember;
}

/** One row's sentence (D77). */
export function activityLine(row: ActivityRow, ctx: LineContext): ActivityLine {
  const entry = rowEntry(row);
  const who = actorName(entry.actorId, ctx.members);
  const { has } = activityCopy;
  if (row.kind === "purchases") {
    return line(
      who,
      has,
      activityCopy.itemCount(row.entries.length),
      activityCopy.bought,
      "shop",
      "item",
    );
  }
  const title = activityCopy.quoted(entry.targetTitle);
  switch (entry.type) {
    case "task_completed":
      return line(who, has, title, activityCopy.completed, "taskDone", "task");
    case "task_created":
      return line(who, has, title, activityCopy.taskCreated, "taskCreated", "task");
    case "task_assigned": {
      const toId = entry.details?.toId;
      const toName = entry.details?.toName;
      if (toId === null || toId === undefined) {
        return line(
          who,
          activityCopy.unassignVerb,
          title,
          activityCopy.unassigned,
          "assign",
          "task",
        );
      }
      if (toId === entry.actorId) {
        return line(who, has, title, activityCopy.tookOver, "assign", "task");
      }
      const name = typeof toName === "string" ? toName : activityCopy.formerMember;
      return line(who, has, title, activityCopy.assignedTo(name), "assign", "task");
    }
    case "item_added":
      return line(who, has, title, activityCopy.addedToShopping, "shop", "item");
    case "item_purchased":
      return line(who, has, title, activityCopy.bought, "shop", "item");
    case "event_created":
      return line(who, has, title, activityCopy.eventCreated, "event", "event");
    case "member_joined":
      return line(who, activityCopy.is, ctx.householdName, activityCopy.joined, "member", "member");
  }
}

/** «Fr., 2. Okt. · 19:30 · Alle», «14.–21. Okt. · Alle», «Do., 1. Okt. · Ganztägig · Alle». */
function eventSummary(event: CalendarEvent, members: readonly Member[], timeZone: string): string {
  const occurrence = singleOccurrence(event, timeZone);
  const who = participantNames(event.participants, members);
  if (event.allDay) {
    const { startKey, endKey } = allDayKeys(occurrence);
    if (isMultiDayAllDay(occurrence)) {
      return calendarCopy.meta(
        formatShortRange(fromDateKey(startKey), fromDateKey(endKey), "UTC"),
        who,
      );
    }
    return calendarCopy.meta(formatDate(fromDateKey(startKey), "UTC"), terms.allDay, who);
  }
  return calendarCopy.meta(
    formatDate(occurrence.start, timeZone),
    formatTime(occurrence.start, timeZone),
    who,
  );
}

export interface SubLine {
  text: string;
  /** «Alle 2 Wochen» after a repeat icon, for an event series. */
  repeat?: string;
}

/** The second line of a row (D78, D79); `null` = none. */
export function activitySubLine(
  subject: ActivitySubject,
  members: readonly Member[],
  timeZone: string,
): SubLine | null {
  if (!subject) return null;
  switch (subject.kind) {
    case "nextOccurrence": {
      const { task } = subject;
      if (task.dueDate === null) return null;
      const date = formatDate(fromDateKey(task.dueDate), "UTC");
      const assignee = task.assigneeId ? actorOf(task.assigneeId, members) : null;
      return {
        text: assignee
          ? activityCopy.nextTurn(assignee.displayName, date)
          : activityCopy.nextOn(date),
      };
    }
    case "item": {
      const { item } = subject;
      return { text: calendarCopy.meta(item.quantity ?? "", shopCategories[item.category].label) };
    }
    case "event": {
      const repeat = subject.event.recurrence
        ? repeatLabel(singleOccurrence(subject.event, timeZone))
        : undefined;
      return {
        text: eventSummary(subject.event, members, timeZone),
        ...(repeat ? { repeat } : {}),
      };
    }
    case "previousAssignee":
      return { text: activityCopy.previously(subject.name ?? activityCopy.nobody) };
    case "purchases":
      return {
        text: activityCopy.purchasedNames(
          subject.names.slice(0, MAX_NAMES),
          Math.max(subject.names.length - MAX_NAMES, 0),
        ),
      };
  }
}

/**
 * A day's heading (D80): «Heute» / «Gestern» / the weekday for 2–6 days ago, each with the date
 * «Mi., 30. Sept.»; older days the date alone (with the year if not this year).
 */
export function activityDayHeading(
  dayKey: string,
  todayKey: string,
): { label: string; date?: string } {
  const date = formatDate(fromDateKey(dayKey), "UTC");
  const days = daysBetweenKeys(dayKey, todayKey);
  if (days === 0) return { label: terms.today, date };
  if (days === 1) return { label: terms.yesterday, date };
  if (days > 1 && days < 7) {
    return { label: formatWeekdayLong(fromDateKey(dayKey), "UTC"), date };
  }
  const year = dayKey.slice(0, 4);
  return { label: year === todayKey.slice(0, 4) ? date : `${date} ${year}` };
}

/** «18:40» on every row (the day is in the heading). */
export function activityTime(row: ActivityRow, timeZone: string): string {
  return formatTime(rowEntry(row).createdAt, timeZone);
}
