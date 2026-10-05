import {
  Timestamp,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
} from "firebase/firestore";
import type { CalendarEvent, EventCategory, EventParticipants, RecurrenceRule } from "../../types";
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
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

function readParticipants(value: unknown): EventParticipants {
  return Array.isArray(value) ? value.filter((uid) => typeof uid === "string") : "household";
}

/** A stored rule (validated by the rules), or `undefined` for a one-off event. */
function readRecurrence(value: unknown): RecurrenceRule | undefined {
  return value && typeof value === "object" && "freq" in value
    ? { ...(value as RecurrenceRule) }
    : undefined;
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
      createdBy: data.createdBy,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      hasPendingWrites: snapshot.metadata.hasPendingWrites,
    };
  },
};
