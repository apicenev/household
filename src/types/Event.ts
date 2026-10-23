import type { RecurrenceRule } from "./Recurrence";

/** Event categories (CAL-07), in the order of the legend and the sheet. */
export type EventCategory = "social" | "appointment" | "travel" | "home" | "reminder" | "other";

/** Who an event is for (CAL-04): everyone in the household, or 1–20 specific members. */
export type EventParticipants = "household" | string[];

/**
 * One occurrence of a series changed on its own (REV-07, Phase 9 B10): new times, and the
 * fields that differ from the series when it was saved. «Ganztägig» stays the series' own.
 */
export interface EventOverride {
  start: Date;
  end: Date;
  title?: string;
  description?: string;
  category?: EventCategory;
  participants?: EventParticipants;
}

/** An exception of a series: the occurrence is cancelled, or changed. */
export type EventException = { cancelled: true } | EventOverride;

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
  /**
   * Repeats (Phase 7): `start` / `end` are the first occurrence (B3); the others are expanded
   * on the client (`occurrencesInRange`) and never stored.
   */
  recurrence?: RecurrenceRule;
  /**
   * Single occurrences cancelled or changed (REV-07, Phase 9 B10), keyed by the occurrence's
   * date on the schedule («2026-10-10»). Series only.
   */
  exceptions?: Record<string, EventException>;
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
  /** Phase 7; `start` / `end` must already be the first occurrence (B3). */
  recurrence?: RecurrenceRule;
}

/**
 * Fields an edit changes; `description: null` removes the description, `recurrence: null`
 * makes the event a one-off (Phase 7 B10).
 */
export interface EventChanges {
  title?: string;
  description?: string | null;
  category?: EventCategory;
  allDay?: boolean;
  start?: Date;
  end?: Date;
  participants?: EventParticipants;
  recurrence?: RecurrenceRule | null;
}

/**
 * One appearance of an event in a date range (Phase 6 B11). A one-off event has exactly one,
 * keyed by the event id; a recurring event one per date, keyed «{eventId}@{date}» (Phase 7
 * B6), so the views never read `events` directly.
 */
export interface EventOccurrence {
  key: string;
  /** The event; for a changed occurrence the series with its override applied (Phase 9). */
  event: CalendarEvent;
  /** First day of this occurrence (household zone; all-day: its key, Phase 6 B2). */
  date: string;
  start: Date;
  end: Date;
  /** Series only: the occurrence's date on the schedule (= `date` unless it was moved). */
  seriesDate?: string;
  /** Changed on its own (REV-07, D94). */
  changed?: boolean;
}
