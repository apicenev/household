/** Event categories (CAL-07), in the order of the legend and the sheet. */
export type EventCategory = "social" | "appointment" | "travel" | "home" | "reminder" | "other";

/** Who an event is for (CAL-04): everyone in the household, or 1–20 specific members. */
export type EventParticipants = "household" | string[];

/**
 * households/{hid}/events/{eventId} (CAL-01…08, Phase 6 B1). Named `CalendarEvent` so it
 * doesn't clash with the DOM `Event`.
 *
 * Times (B2): a **timed** event stores real instants, shown in the household time zone. An
 * **all-day** event stores floating dates: `start` = 00:00 UTC of its first day, `end` =
 * 00:00 UTC of its last day (inclusive), so a one-day event has `start == end`. Read all-day
 * dates only through `allDayKeys` (domain/eventTime), never by formatting them in a zone.
 */
export interface CalendarEvent {
  id: string;
  /** 1–200 characters, trimmed. */
  title: string;
  /** 1–2000 characters; missing without a description. */
  description?: string;
  category: EventCategory;
  allDay: boolean;
  start: Date;
  end: Date;
  participants: EventParticipants;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  /** A local write to this event hasn't reached the server yet. Read model only. */
  hasPendingWrites: boolean;
}

/** What the Termin-Sheet and the Schnellerfassung produce. */
export interface NewEventInput {
  title: string;
  description?: string;
  category: EventCategory;
  allDay: boolean;
  start: Date;
  end: Date;
  participants: EventParticipants;
}

/** Fields an edit changes; `description: null` removes the description. */
export interface EventChanges {
  title?: string;
  description?: string | null;
  category?: EventCategory;
  allDay?: boolean;
  start?: Date;
  end?: Date;
  participants?: EventParticipants;
}

/**
 * One appearance of an event in a date range (B11). In Phase 6 every event has exactly one,
 * keyed by the event id; Phase 7 expands recurring events into one per date
 * («{eventId}@{date}»), so the views never read `events` directly.
 */
export interface EventOccurrence {
  key: string;
  event: CalendarEvent;
  start: Date;
  end: Date;
}
