import { beforeEach, describe, expect, it, vi } from "vitest";
import { allDayToStored } from "../domain/eventTime";

// In-memory stand-in for the Firestore calls eventService makes: batches and single writes
// record their operations.
type Op = { op: string; path: string; data?: unknown };
const fake = vi.hoisted(() => {
  const state = {
    commits: [] as Op[][],
    writes: [] as Op[],
    autoId: 0,
  };
  return { state };
});

vi.mock("../lib/firebase", () => ({ db: {} }));

vi.mock("firebase/firestore", () => {
  const { state } = fake;
  type Parent = { kind?: string; path?: string };
  const ref = (path: string) => ({ path, id: path.split("/").pop() ?? "" });
  return {
    Timestamp: { fromDate: (date: Date) => `TS(${date.toISOString()})` },
    collection: (_db: unknown, ...segments: string[]) => ({
      kind: "collection",
      path: segments.join("/"),
      withConverter() {
        return this;
      },
    }),
    doc: (parent: Parent, ...segments: string[]) =>
      parent?.kind === "collection"
        ? ref(`${parent.path}/${segments[0] ?? `auto${++state.autoId}`}`)
        : ref(segments.join("/")),
    writeBatch: () => {
      const ops: Op[] = [];
      return {
        set: (r: { path: string }, data: unknown) => ops.push({ op: "set", path: r.path, data }),
        update: (r: { path: string }, data: unknown) =>
          ops.push({ op: "update", path: r.path, data }),
        delete: (r: { path: string }) => ops.push({ op: "delete", path: r.path }),
        commit: async () => {
          state.commits.push(ops);
        },
      };
    },
    updateDoc: async (r: { path: string }, data: unknown) => {
      state.writes.push({ op: "update", path: r.path, data });
    },
    deleteDoc: async (r: { path: string }) => {
      state.writes.push({ op: "delete", path: r.path });
    },
    serverTimestamp: () => "SERVER_TIME",
    deleteField: () => "DELETE_FIELD",
    onSnapshot: vi.fn(),
  };
});

const { createEvent, deleteEvent, updateEvent } = await import("./eventService");

beforeEach(() => {
  fake.state.commits = [];
  fake.state.writes = [];
  fake.state.autoId = 0;
});

describe("createEvent", () => {
  it("writes the event and «event_created» with the same id and title in one batch", async () => {
    const { id, committed } = createEvent(
      "h1",
      {
        title: "  Znacht mit Freunden ",
        description: " Wir bringen das Dessert. ",
        category: "social",
        allDay: false,
        start: new Date("2026-10-02T17:30:00Z"),
        end: new Date("2026-10-02T20:30:00Z"),
        participants: ["anna"],
      },
      "nevio",
    );
    await committed;

    expect(id).toBe("auto1");
    expect(fake.state.commits).toEqual([
      [
        {
          op: "set",
          path: "households/h1/events/auto1",
          data: {
            title: "Znacht mit Freunden",
            description: "Wir bringen das Dessert.",
            category: "social",
            allDay: false,
            start: "TS(2026-10-02T17:30:00.000Z)",
            end: "TS(2026-10-02T20:30:00.000Z)",
            participants: ["anna"],
            createdBy: "nevio",
            createdAt: "SERVER_TIME",
            updatedAt: "SERVER_TIME",
          },
        },
        {
          op: "set",
          path: "households/h1/activity/auto2",
          data: {
            actorId: "nevio",
            type: "event_created",
            targetType: "event",
            targetId: "auto1",
            targetTitle: "Znacht mit Freunden",
            createdAt: "SERVER_TIME",
          },
        },
      ],
    ]);
  });

  it("leaves out an empty description and stores all-day dates at 00:00 UTC", async () => {
    await createEvent(
      "h1",
      {
        title: "Ferien",
        description: "   ",
        category: "travel",
        allDay: true,
        ...allDayToStored("2026-10-14", "2026-10-21"),
        participants: "household",
      },
      "nevio",
    ).committed;

    const data = fake.state.commits[0][0].data as Record<string, unknown>;
    expect(data).not.toHaveProperty("description");
    expect(data).toMatchObject({
      allDay: true,
      start: "TS(2026-10-14T00:00:00.000Z)",
      end: "TS(2026-10-21T00:00:00.000Z)",
      participants: "household",
    });
  });
});

describe("updateEvent / deleteEvent", () => {
  it("writes only the changed fields and removes a cleared description", async () => {
    await updateEvent("h1", "e1", {
      title: " Arzt ",
      description: null,
      category: "appointment",
      participants: ["anna"],
    });
    await updateEvent("h1", "e2", { description: "  " });
    await updateEvent("h1", "e3", {
      allDay: true,
      start: new Date("2026-10-14T00:00:00Z"),
      end: new Date("2026-10-15T00:00:00Z"),
    });

    expect(fake.state.writes).toEqual([
      {
        op: "update",
        path: "households/h1/events/e1",
        data: {
          updatedAt: "SERVER_TIME",
          title: "Arzt",
          description: "DELETE_FIELD",
          category: "appointment",
          participants: ["anna"],
        },
      },
      {
        op: "update",
        path: "households/h1/events/e2",
        data: { updatedAt: "SERVER_TIME", description: "DELETE_FIELD" },
      },
      {
        op: "update",
        path: "households/h1/events/e3",
        data: {
          updatedAt: "SERVER_TIME",
          allDay: true,
          start: "TS(2026-10-14T00:00:00.000Z)",
          end: "TS(2026-10-15T00:00:00.000Z)",
        },
      },
    ]);
  });

  it("writes nothing without changes", async () => {
    await updateEvent("h1", "e1", {});
    expect(fake.state.writes).toEqual([]);
  });

  it("deletes the event without activity", async () => {
    await deleteEvent("h1", "e1");
    expect(fake.state.writes).toEqual([{ op: "delete", path: "households/h1/events/e1" }]);
    expect(fake.state.commits).toEqual([]);
  });
});
