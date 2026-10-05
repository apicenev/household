import { normalizeParticipants } from "../../domain/calendar";
import { addDaysToKey, daysBetweenKeys } from "../../domain/dateKeys";
import {
  allDayKeys,
  allDayToStored,
  defaultTimes,
  EVENT_DESCRIPTION_MAX,
  EVENT_TITLE_MAX,
  instantToZoned,
  moveEndKeyWithStart,
  moveEndWithStart,
  validateEventTimes,
  zonedToInstant,
  type EventTimesError,
} from "../../domain/eventTime";
import {
  eventPickerFromRule,
  eventRuleFromPicker,
  sameRule,
  snapToSchedule,
  type EventPickerState,
} from "../../domain/recurrence";
import type {
  CalendarEvent,
  EventCategory,
  EventChanges,
  EventParticipants,
  Member,
  NewEventInput,
  RecurrenceRule,
  WeekStart,
} from "../../types";

/**
 * The Termin-Sheet's state (6.8) and its rules, pure: defaults (B6), a new start keeps the
 * end unless it passes it (B6), «Ganztägig» keeps the times for switching back, the «Für» chips (D58), validation
 * (CAL-05, B3) and what gets saved (only changed fields; participants without former members,
 * B5). Phase 7: «Wiederholen» (`repeat`, anchored at the start day); on save the start moves
 * to the first occurrence (B3) and an «Endet am» before it is an error (D66).
 */

/** New events default to «Sonstiges» (B6). */
export const DEFAULT_EVENT_CATEGORY: EventCategory = "other";

export interface EventFormValues {
  title: string;
  description: string;
  category: EventCategory;
  allDay: boolean;
  /** First / last day («2026-10-02»); for timed events the local days of start and end. */
  startKey: string;
  endKey: string;
  /** Local clock times («19:30»); kept while «Ganztägig» is on, for switching back. */
  startTime: string;
  endTime: string;
  participants: EventParticipants;
  /** «Wiederholen» (Phase 7); the rule takes day, weekday and month from `startKey`. */
  repeat: EventPickerState;
}

/** What the Schnellerfassung or a day passes to «Neuer Termin». */
export interface EventPrefill {
  title?: string;
  dayKey?: string;
}

interface Context {
  now: Date;
  timeZone: string;
}

/** Values of a new event on `dayKey` (B6), or of an existing one. */
export function initialEventFormValues(
  event: CalendarEvent | undefined,
  prefill: EventPrefill,
  { now, timeZone }: Context,
): EventFormValues {
  if (!event) {
    const dayKey = prefill.dayKey ?? instantToZoned(now, timeZone).dateKey;
    const times = defaultTimes(dayKey, now, timeZone);
    return {
      title: prefill.title ?? "",
      description: "",
      category: DEFAULT_EVENT_CATEGORY,
      allDay: false,
      ...times,
      participants: "household",
      repeat: eventPickerFromRule(undefined, times.startKey),
    };
  }
  const base = {
    title: event.title,
    description: event.description ?? "",
    category: event.category,
    allDay: event.allDay,
    participants: event.participants,
  };
  if (event.allDay) {
    const { startKey, endKey } = allDayKeys(event);
    // Times for switching «Ganztägig» off: the defaults of the first day.
    const times = defaultTimes(startKey, now, timeZone);
    return {
      ...base,
      startKey,
      endKey,
      startTime: times.startTime,
      endTime: times.endTime,
      repeat: eventPickerFromRule(event.recurrence, startKey),
    };
  }
  const start = instantToZoned(event.start, timeZone);
  const end = instantToZoned(event.end, timeZone);
  return {
    ...base,
    startKey: start.dateKey,
    startTime: start.time,
    endKey: end.dateKey,
    endTime: end.time,
    repeat: eventPickerFromRule(event.recurrence, start.dateKey),
  };
}

/** The rule «Wiederholen» stands for, anchored at the start day; `null` for «Nie». */
export function formRule(values: EventFormValues): RecurrenceRule | null {
  return eventRuleFromPicker(values.repeat, values.startKey);
}

/**
 * The values as saved (Phase 7 B3): with a rule, start and end move to its first occurrence
 * on or after the start day (same times, same number of days), so the stored start is always
 * the first occurrence.
 */
export function snappedValues(values: EventFormValues, weekStartsOn: WeekStart): EventFormValues {
  const rule = formRule(values);
  if (!rule) return values;
  const first = snapToSchedule(rule, values.startKey, weekStartsOn);
  if (first === values.startKey) return values;
  const shift = daysBetweenKeys(values.startKey, first);
  return { ...values, startKey: first, endKey: addDaysToKey(values.endKey, shift) };
}

/** The stored times of the values (B2): instants, or 00:00 UTC dates for all-day events. */
export function storedTimes(values: EventFormValues, timeZone: string) {
  if (values.allDay) return { allDay: true, ...allDayToStored(values.startKey, values.endKey) };
  return {
    allDay: false,
    start: zonedToInstant(values.startKey, values.startTime, timeZone),
    end: zonedToInstant(values.endKey, values.endTime, timeZone),
  };
}

/**
 * A new start day and / or time (B6): the end stays where it is while it's still on or after
 * the new start; only a start moved past the end takes the end along, keeping the duration, so
 * moving the start never makes the event invalid.
 */
export function withStart(
  values: EventFormValues,
  change: { key?: string; time?: string },
  timeZone: string,
): EventFormValues {
  const startKey = change.key ?? values.startKey;
  const startTime = change.time ?? values.startTime;
  if (values.allDay) {
    return {
      ...values,
      startKey,
      startTime,
      endKey:
        startKey <= values.endKey
          ? values.endKey
          : moveEndKeyWithStart(values.startKey, values.endKey, startKey),
    };
  }
  const oldStart = zonedToInstant(values.startKey, values.startTime, timeZone);
  const oldEnd = zonedToInstant(values.endKey, values.endTime, timeZone);
  const newStart = zonedToInstant(startKey, startTime, timeZone);
  if (newStart.getTime() <= oldEnd.getTime()) return { ...values, startKey, startTime };
  const end = instantToZoned(moveEndWithStart(oldStart, oldEnd, newStart), timeZone);
  return { ...values, startKey, startTime, endKey: end.dateKey, endTime: end.time };
}

/** A new end day and / or time; may produce the D48 error. */
export function withEnd(
  values: EventFormValues,
  change: { key?: string; time?: string },
): EventFormValues {
  return { ...values, endKey: change.key ?? values.endKey, endTime: change.time ?? values.endTime };
}

/**
 * «Ganztägig» on: the days the event touches (an end at 00:00 doesn't count the next day);
 * off: back to the kept times on the first day, ending on the last one.
 */
export function withAllDay(values: EventFormValues, allDay: boolean): EventFormValues {
  if (allDay === values.allDay) return values;
  if (!allDay) return { ...values, allDay };
  const endsAtMidnight = values.endTime === "00:00" && values.endKey > values.startKey;
  return {
    ...values,
    allDay,
    endKey: endsAtMidnight ? addDaysToKey(values.endKey, -1) : values.endKey,
  };
}

/**
 * The «Für» chips (D58): «Alle» → only the picked member; more members add up; the last one
 * can't be removed; every current member picked → «Alle».
 */
export function toggleParticipant(
  participants: EventParticipants,
  uid: string,
  members: readonly Member[],
): EventParticipants {
  if (participants === "household") return members.length <= 1 ? "household" : [uid];
  const current = participants.filter((id) => members.some((member) => member.uid === id));
  if (current.includes(uid)) {
    const rest = current.filter((id) => id !== uid);
    return rest.length === 0 ? current : rest;
  }
  return normalizeParticipants([...current, uid], members);
}

export type EventFormError =
  "titleEmpty" | "titleTooLong" | "descriptionTooLong" | "untilBeforeStart" | EventTimesError;

/**
 * What's wrong with the values, field by field (CAL-04, CAL-05, B3); `until` (D66): «Endet
 * am» before the first occurrence, which would leave a series without any.
 */
export function validateEventForm(
  values: EventFormValues,
  timeZone: string,
  weekStartsOn: WeekStart = 1,
): {
  title?: EventFormError;
  description?: EventFormError;
  times?: EventFormError;
  until?: EventFormError;
} {
  const title = values.title.trim();
  const problems: ReturnType<typeof validateEventForm> = {};
  if (!title) problems.title = "titleEmpty";
  else if (title.length > EVENT_TITLE_MAX) problems.title = "titleTooLong";
  if (values.description.trim().length > EVENT_DESCRIPTION_MAX) {
    problems.description = "descriptionTooLong";
  }
  const times = validateEventTimes(storedTimes(values, timeZone));
  if (times) problems.times = times;
  const rule = formRule(values);
  if (rule?.until !== undefined && rule.until < snappedValues(values, weekStartsOn).startKey) {
    problems.until = "untilBeforeStart";
  }
  return problems;
}

/**
 * The new event (CAL-04); participants normalised (B5, D58); a series starts on its first
 * occurrence (Phase 7 B3). `weekStartsOn` only matters for «every N weeks».
 */
export function eventInput(
  values: EventFormValues,
  timeZone: string,
  members: readonly Member[],
  weekStartsOn: WeekStart = 1,
): NewEventInput {
  const description = values.description.trim();
  const rule = formRule(values);
  return {
    title: values.title.trim(),
    ...(description ? { description } : {}),
    category: values.category,
    ...storedTimes(snappedValues(values, weekStartsOn), timeZone),
    participants: normalizeParticipants(values.participants, members),
    ...(rule ? { recurrence: rule } : {}),
  };
}

const sameParticipants = (a: EventParticipants, b: EventParticipants) =>
  a === "household" || b === "household"
    ? a === b
    : a.length === b.length && a.every((uid, index) => uid === b[index]);

/**
 * Only the fields that changed (CAL-06). Participants are written whenever their normalised
 * form differs from the stored one, so a former member is dropped on any save (B5): the rules
 * check the whole event.
 */
export function eventChanges(
  original: CalendarEvent,
  values: EventFormValues,
  timeZone: string,
  members: readonly Member[],
  weekStartsOn: WeekStart = 1,
): EventChanges {
  const next = eventInput(values, timeZone, members, weekStartsOn);
  const changes: EventChanges = {};
  if (next.title !== original.title) changes.title = next.title;
  if ((next.description ?? "") !== (original.description ?? "")) {
    changes.description = next.description ?? null;
  }
  if (next.category !== original.category) changes.category = next.category;
  if (next.allDay !== original.allDay) changes.allDay = next.allDay;
  if (next.start.getTime() !== original.start.getTime()) changes.start = next.start;
  if (next.end.getTime() !== original.end.getTime()) changes.end = next.end;
  if (!sameParticipants(next.participants, original.participants)) {
    changes.participants = next.participants;
  }
  // Phase 7 B10: a changed rule, or «Nie» (null) for a series.
  if (!sameRule(next.recurrence, original.recurrence)) {
    changes.recurrence = next.recurrence ?? null;
  }
  return changes;
}
