import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  FieldPath,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { eventConverter, exceptionToDoc } from "../lib/converters/eventConverter";
import { db } from "../lib/firebase";
import type {
  CalendarEvent,
  EventChanges,
  EventException,
  EventOverride,
  EventParticipants,
  NewEventInput,
  RecurrenceRule,
} from "../types";
import { record } from "./activityService";

/**
 * The calendar of a household (Phase 6). Creating an event writes «event_created» in the same
 * batch (ACT-01, ACT-05, B12), once per series (Phase 7 B14); edits and deletes write no activity. Times are stored as given
 * (B2: all-day dates at 00:00 UTC, built with `allDayToStored`). Every function returns the
 * commit promise: the UI doesn't wait for it (latency compensation), it only reports a
 * rejection.
 */

function eventsCollection(householdId: string) {
  return collection(db, "households", householdId, "events");
}

function eventRef(householdId: string, eventId: string) {
  return doc(db, "households", householdId, "events", eventId);
}

function participantsData(participants: EventParticipants): EventParticipants {
  return participants === "household" ? "household" : [...participants];
}

/** A rule without `undefined` fields (Firestore rejects them). */
function recurrenceData(rule: RecurrenceRule): RecurrenceRule {
  return Object.fromEntries(
    Object.entries(rule).filter(([, value]) => value !== undefined),
  ) as unknown as RecurrenceRule;
}

/** Realtime list of all events (B10), incl. pending-write state. */
export function listenToEvents(
  householdId: string,
  onChange: (events: CalendarEvent[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    eventsCollection(householdId).withConverter(eventConverter),
    { includeMetadataChanges: true },
    (snapshot) => onChange(snapshot.docs.map((d) => d.data())),
    onError,
  );
}

/** Creates an event and its «event_created» entry (CAL-04). Title and description are trimmed. */
export function createEvent(
  householdId: string,
  input: NewEventInput,
  actorId: string,
): { id: string; committed: Promise<void> } {
  const ref = doc(eventsCollection(householdId));
  const title = input.title.trim();
  const description = input.description?.trim();
  const batch = writeBatch(db);
  batch.set(ref, {
    title,
    ...(description ? { description } : {}),
    category: input.category,
    allDay: input.allDay,
    start: Timestamp.fromDate(input.start),
    end: Timestamp.fromDate(input.end),
    participants: participantsData(input.participants),
    ...(input.recurrence ? { recurrence: recurrenceData(input.recurrence) } : {}),
    createdBy: actorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  record(batch, householdId, {
    actorId,
    type: "event_created",
    targetType: "event",
    targetId: ref.id,
    targetTitle: title,
  });
  return { id: ref.id, committed: batch.commit() };
}

/**
 * Writes only the changed fields (CAL-06); `description: null` (or empty) removes it, and
 * `recurrence: null` makes a series a one-off event (Phase 7 B10). The
 * rules check the whole resulting event, so a caller must pass participants without former
 * members (`normalizeParticipants`, B5) whenever the stored list may hold one.
 */
export function updateEvent(
  householdId: string,
  eventId: string,
  changes: EventChanges,
  { clearExceptions = false }: { clearExceptions?: boolean } = {},
): Promise<void> {
  if (Object.keys(changes).length === 0) return Promise.resolve();
  const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
  // Phase 9 B12: a new rule, start or times reset the single-occurrence changes.
  if (clearExceptions) {
    data.exceptions = deleteField();
    data.lastExceptionKey = deleteField();
  }
  if (changes.title !== undefined) data.title = changes.title.trim();
  if (changes.description !== undefined) {
    const description = changes.description?.trim();
    data.description = description ? description : deleteField();
  }
  if (changes.category !== undefined) data.category = changes.category;
  if (changes.allDay !== undefined) data.allDay = changes.allDay;
  if (changes.start !== undefined) data.start = Timestamp.fromDate(changes.start);
  if (changes.end !== undefined) data.end = Timestamp.fromDate(changes.end);
  if (changes.participants !== undefined) {
    data.participants = participantsData(changes.participants);
  }
  if (changes.recurrence !== undefined) {
    data.recurrence = changes.recurrence ? recurrenceData(changes.recurrence) : deleteField();
  }
  return updateDoc(eventRef(householdId, eventId), data);
}

/**
 * Writes one exception of a series (REV-07, Phase 9 B10) under its schedule date, naming the
 * key in `lastExceptionKey` for the rules. No activity (edits write none).
 */
function writeException(
  householdId: string,
  eventId: string,
  dateKey: string,
  exception: EventException,
): Promise<void> {
  return updateDoc(
    eventRef(householdId, eventId),
    new FieldPath("exceptions", dateKey),
    exceptionToDoc(exception),
    "lastExceptionKey",
    dateKey,
    "updatedAt",
    serverTimestamp(),
  );
}

/** «Nur diesen Termin» löschen (REV-07): the occurrence on `dateKey` is cancelled. */
export function cancelOccurrence(
  householdId: string,
  eventId: string,
  dateKey: string,
): Promise<void> {
  return writeException(householdId, eventId, dateKey, { cancelled: true });
}

/** «Nur diesen Termin» bearbeiten (REV-07): the occurrence on `dateKey` gets `override`. */
export function editOccurrence(
  householdId: string,
  eventId: string,
  dateKey: string,
  override: EventOverride,
): Promise<void> {
  const clean: EventOverride = { ...override };
  if (clean.title !== undefined) clean.title = clean.title.trim();
  if (clean.description !== undefined) clean.description = clean.description.trim();
  if (clean.participants !== undefined) {
    clean.participants = participantsData(clean.participants);
  }
  return writeException(householdId, eventId, dateKey, clean);
}

/** Deletes an event (CAL-06, B13); no activity. */
export function deleteEvent(householdId: string, eventId: string): Promise<void> {
  return deleteDoc(eventRef(householdId, eventId));
}
