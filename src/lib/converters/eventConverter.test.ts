import { Timestamp, type QueryDocumentSnapshot } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "../../types";
import { eventConverter } from "./eventConverter";

function snapshot(id: string, data: Record<string, unknown>, hasPendingWrites = false) {
  return {
    id,
    data: () => data,
    metadata: { hasPendingWrites },
  } as unknown as QueryDocumentSnapshot;
}

const event: CalendarEvent = {
  id: "e1",
  title: "Ferien",
  description: "Lissabon.",
  category: "travel",
  allDay: true,
  start: new Date("2026-10-14T00:00:00Z"),
  end: new Date("2026-10-21T00:00:00Z"),
  participants: ["nevio", "anna"],
  createdBy: "nevio",
  createdAt: new Date("2026-09-30T10:00:00Z"),
  updatedAt: new Date("2026-09-30T11:00:00Z"),
  hasPendingWrites: false,
};

describe("eventConverter", () => {
  it("round-trips an event (all-day dates stay at 00:00 UTC)", () => {
    const stored = eventConverter.toFirestore(event) as Record<string, unknown>;
    expect(stored).not.toHaveProperty("id");
    expect(stored).not.toHaveProperty("hasPendingWrites");
    expect(stored.start).toEqual(Timestamp.fromDate(event.start));
    expect(eventConverter.fromFirestore(snapshot("e1", stored))).toEqual(event);
  });

  it("leaves out a missing description and reads «household» and pending writes", () => {
    const stored = eventConverter.toFirestore({
      ...event,
      description: undefined,
      participants: "household",
    }) as Record<string, unknown>;
    expect(stored).not.toHaveProperty("description");
    const read = eventConverter.fromFirestore(snapshot("e1", stored, true));
    expect(read.description).toBeUndefined();
    expect(read.participants).toBe("household");
    expect(read.hasPendingWrites).toBe(true);
  });
});

describe("eventConverter: recurrence (Phase 7)", () => {
  it("round-trips a rule and leaves it out for one-off events", () => {
    const series: CalendarEvent = {
      ...event,
      recurrence: { freq: "monthly", interval: 1, byWeekday: [6], bySetPos: 1, count: 5 },
    };
    const stored = eventConverter.toFirestore(series) as Record<string, unknown>;
    expect(stored.recurrence).toEqual(series.recurrence);
    expect(eventConverter.fromFirestore(snapshot("e1", stored))).toEqual(series);

    const oneOff = eventConverter.toFirestore(event) as Record<string, unknown>;
    expect(oneOff).not.toHaveProperty("recurrence");
    expect(eventConverter.fromFirestore(snapshot("e1", oneOff)).recurrence).toBeUndefined();
    expect(
      eventConverter.fromFirestore(snapshot("e1", { ...oneOff, recurrence: null })).recurrence,
    ).toBeUndefined();
  });
});
