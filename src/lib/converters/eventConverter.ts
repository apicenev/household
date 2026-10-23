import {
  Timestamp,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
} from "firebase/firestore";
import type {
  CalendarEvent,
  EventCategory,
  EventException,
  EventParticipants,
  RecurrenceRule,
} from "../../types";
import { toDate } from "./userProfileConverter";

/** Firestore shape of households/{hid}/events/{eventId} (Phase 6 B1, Phase 7 B1). */
export interface EventDoc {
  title: string;
  description?: string;
  category: EventCategory;
  allDay: boolean;
  start: Timestamp;
  end: Timestamp;
  participants: EventParticipants;
  recurrence?: RecurrenceRule;
  /** Phase 9 B10: by schedule date; `{ cancelled: true }` or an override. */
  exceptions?: Record<string, ExceptionDoc>;
  /** Phase 9 B10: the key of the last exception write, for the rules only. */
  lastExceptionKey?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Stored shape of one exception (Timestamps instead of Dates). */
export type ExceptionDoc =
  | { cancelled: true }
  | {
      start: Timestamp;
      end: Timestamp;
      title?: string;
      description?: string;
      category?: EventCategory;
      participants?: EventParticipants;
    };

function readParticipants(value: unknown): EventParticipants {
  return Array.isArray(value) ? value.filter((uid) => typeof uid === "string") : "household";
}

/** A stored rule (validated by the rules), or `undefined` for a one-off event. */
function readRecurrence(value: unknown): RecurrenceRule | undefined {
  return value && typeof value === "object" && "freq" in value
    ? { ...(value as RecurrenceRule) }
    : undefined;
}

/** Stored exceptions (validated by the rules), or `undefined` without any. */
function readExceptions(value: unknown): Record<string, EventException> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const exceptions: Record<string, EventException> = {};
  for (const [key, raw] of Object.entries(value as Record<string, Record<string, unknown>>)) {
    if (!raw || typeof raw !== "object") continue;
    if (raw.cancelled === true) {
      exceptions[key] = { cancelled: true };
      continue;
    }
    exceptions[key] = {
      start: toDate(raw.start),
      end: toDate(raw.end),
      ...(typeof raw.title === "string" ? { title: raw.title } : {}),
      ...(typeof raw.description === "string" ? { description: raw.description } : {}),
      ...(typeof raw.category === "string" ? { category: raw.category as EventCategory } : {}),
      ...(raw.participants !== undefined
        ? { participants: readParticipants(raw.participants) }
        : {}),
    };
  }
  return Object.keys(exceptions).length > 0 ? exceptions : undefined;
}

/** An exception as stored. */
export function exceptionToDoc(exception: EventException): ExceptionDoc {
  if ("cancelled" in exception) return { cancelled: true };
  const { start, end, ...rest } = exception;
  return { ...rest, start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) };
}

/**
 * households/{hid}/events/{eventId} ⇄ CalendarEvent (Timestamp ⇄ Date, missing ⇄
 * undefined). All-day dates stay at 00:00 UTC (B2); pending server times read as estimates.
 */
export const eventConverter: FirestoreDataConverter<CalendarEvent, EventDoc> = {
  toFirestore(event) {
    const e = event as CalendarEvent;
    const data: EventDoc = {
      title: e.title,
      category: e.category,
      allDay: e.allDay,
      start: Timestamp.fromDate(e.start),
      end: Timestamp.fromDate(e.end),
      participants: e.participants,
      createdBy: e.createdBy,
      createdAt: Timestamp.fromDate(e.createdAt),
      updatedAt: Timestamp.fromDate(e.updatedAt),
    };
    if (e.description !== undefined) data.description = e.description;
    if (e.recurrence !== undefined) data.recurrence = e.recurrence;
    if (e.exceptions !== undefined) {
      data.exceptions = Object.fromEntries(
        Object.entries(e.exceptions).map(([key, exception]) => [key, exceptionToDoc(exception)]),
      );
    }
    return data;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot<DocumentData>, options?: SnapshotOptions) {
    const data = snapshot.data({ serverTimestamps: "estimate", ...options });
    return {
      id: snapshot.id,
      title: data.title,
      description: data.description ?? undefined,
      category: data.category as EventCategory,
      allDay: data.allDay === true,
      start: toDate(data.start),
      end: toDate(data.end),
      participants: readParticipants(data.participants),
      recurrence: readRecurrence(data.recurrence),
      exceptions: readExceptions(data.exceptions),
      createdBy: data.createdBy,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      hasPendingWrites: snapshot.metadata.hasPendingWrites,
    };
  },
};
