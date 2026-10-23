import { Timestamp, type QueryDocumentSnapshot } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import { occurrencesInRange } from "../domain/calendar";
import { addDaysToKey } from "../domain/dateKeys";
import { lastCompleted, overdueTasks, shoppingPreview, upcomingWeek } from "../domain/dashboard";
import { occurrenceDates } from "../domain/recurrence";
import { todayKey } from "../domain/tasks";
import { eventConverter } from "../lib/converters/eventConverter";
import { householdConverter } from "../lib/converters/householdConverter";
import { shoppingItemConverter } from "../lib/converters/shoppingItemConverter";
import { taskConverter } from "../lib/converters/taskConverter";
import type { CalendarEvent, ShoppingItem, Task } from "../types";
import { buildDemoData, DEMO_HOUSEHOLD_NAME, slug, type DemoDoc } from "./demoData";

const ZURICH = "Europe/Zurich";
const users = [
  { uid: "demo1", email: "demo1@example.com" },
  { uid: "demo2", email: "demo2@example.com" },
] as const;
const NOW = new Date("2026-10-23T07:30:00Z");

const build = (now = NOW) =>
  buildDemoData({ now, householdId: "demo", inviteCode: "DEM-1234", users });

/** Dates → Timestamps, as Firestore hands them back. */
function stored(value: unknown): unknown {
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (Array.isArray(value)) return value.map(stored);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stored(v)]));
  }
  return value;
}

/** Reads a doc through a converter, as the app would. */
function read<T>(
  converter: { fromFirestore: (snapshot: QueryDocumentSnapshot) => T },
  doc: DemoDoc,
): T {
  const snapshot = {
    id: doc.path.split("/").at(-1),
    data: () => stored(doc.data),
    metadata: { hasPendingWrites: false },
  } as unknown as QueryDocumentSnapshot;
  return converter.fromFirestore(snapshot);
}

function collections(now = NOW) {
  const { docs } = build(now);
  const of = (name: string) => docs.filter((doc) => doc.path.split("/")[2] === name);
  return {
    docs,
    tasks: of("tasks").map((doc) => read<Task>(taskConverter, doc)),
    items: of("shoppingItems").map((doc) => read<ShoppingItem>(shoppingItemConverter, doc)),
    events: of("events").map((doc) => read<CalendarEvent>(eventConverter, doc)),
    activity: of("activity").map((doc) => doc.data),
  };
}

describe("buildDemoData (Phase 9 §9.9)", () => {
  it("is deterministic for a given moment", () => {
    expect(build()).toEqual(build());
  });

  it("writes the guarded demo household with both users", () => {
    const household = read(
      householdConverter,
      build().docs.find((doc) => doc.path === "households/demo")!,
    );
    expect(household).toMatchObject({
      name: DEMO_HOUSEHOLD_NAME,
      ownerId: "demo1",
      memberIds: ["demo1", "demo2"],
      demo: true,
    });
    const profiles = build().docs.filter((doc) => doc.path.startsWith("users/"));
    expect(profiles.map((doc) => doc.data)).toEqual([
      expect.objectContaining({ displayName: "Demo User 1", initials: "D1", householdId: "demo" }),
      expect.objectContaining({ displayName: "Demo User 2", initials: "D2", householdId: "demo" }),
    ]);
  });

  it("never goes stale: no due dates, every event repeats without an end (C3)", () => {
    const { tasks, events } = collections();
    expect(tasks.every((task) => task.dueDate === null)).toBe(true);
    expect(tasks.filter((task) => task.status === "open")).toHaveLength(12);
    expect(tasks.filter((task) => task.status === "done")).toHaveLength(10);
    for (const event of events) {
      expect(event.recurrence, event.title).toBeDefined();
      expect(event.recurrence?.until).toBeUndefined();
      expect(event.recurrence?.count).toBeUndefined();
    }
  });

  it("starts every series on its own schedule, before now (Phase 7 B3)", () => {
    const { events } = collections();
    const today = todayKey(NOW, ZURICH);
    for (const event of events) {
      const anchor = event.allDay
        ? event.start.toISOString().slice(0, 10)
        : todayKey(event.start, ZURICH);
      expect(anchor < today, event.title).toBe(true);
      expect(occurrenceDates(event.recurrence!, anchor, anchor, anchor, 1), event.title).toEqual([
        anchor,
      ]);
    }
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 8, 30, 365])(
    "fills Start %i days after setup (C3)",
    (daysLater) => {
      const later = new Date(NOW.getTime() + daysLater * 24 * 60 * 60 * 1000);
      const { tasks, items, events } = collections();
      const today = todayKey(later, ZURICH);
      expect(overdueTasks(tasks, today)).toEqual([]);
      expect(shoppingPreview(items).openCount).toBe(13);
      expect(lastCompleted(tasks)).toHaveLength(5);
      expect(upcomingWeek(events, later, ZURICH, 1).length).toBeGreaterThanOrEqual(3);
    },
  );

  it("has at least three events in every week of the next year", () => {
    const { events } = collections();
    const start = todayKey(NOW, ZURICH);
    for (let week = 0; week < 52; week++) {
      const first = addDaysToKey(start, week * 7);
      const count = occurrencesInRange(events, first, addDaysToKey(first, 6), ZURICH, 1).length;
      expect(count, first).toBeGreaterThanOrEqual(3);
    }
  });

  it.each([
    "2026-01-31T10:00:00Z",
    "2026-02-28T22:30:00Z",
    "2026-03-29T00:30:00Z",
    "2028-02-29T12:00:00Z",
  ])("builds valid series at month ends and DST changes (%s)", (iso) => {
    const now = new Date(iso);
    const { events } = collections(now);
    for (const event of events) {
      const anchor = event.allDay
        ? event.start.toISOString().slice(0, 10)
        : todayKey(event.start, ZURICH);
      expect(occurrenceDates(event.recurrence!, anchor, anchor, anchor, 1), event.title).toEqual([
        anchor,
      ]);
      expect(event.end.getTime()).toBeGreaterThanOrEqual(event.start.getTime());
    }
  });

  it("tells the same story in the feed as in the lists", () => {
    const { docs, activity } = collections();
    const ids = new Set(docs.map((doc) => doc.path.split("/").at(-1)));
    for (const entry of activity) {
      expect(ids.has(entry.targetId as string), String(entry.targetTitle)).toBe(true);
      expect((entry.createdAt as Date).getTime()).toBeLessThan(NOW.getTime());
    }
    const times = activity.map((entry) => (entry.createdAt as Date).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(activity.filter((entry) => entry.type === "item_purchased")).toHaveLength(5);
    expect(activity.some((entry) => entry.type === "task_assigned")).toBe(true);
  });

  it("makes stable ids", () => {
    expect(slug("Küche putzen")).toBe("kueche-putzen");
    expect(slug("Äpfel")).toBe("aepfel");
    expect(slug("Velo-Service buchen")).toBe("velo-service-buchen");
  });
});
