import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "../types";

// In-memory stand-in for the Firestore calls taskService makes: batches and single writes
// record their operations.
const fake = vi.hoisted(() => {
  const state = {
    commits: [] as Array<Array<{ op: string; path: string; data?: unknown }>>,
    writes: [] as Array<{ op: string; path: string; data?: unknown }>,
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
    Timestamp: class {},
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
      const ops: Array<{ op: string; path: string; data?: unknown }> = [];
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

const { completeTask, createTask, deleteTask, reopenTask, updateTask } =
  await import("./taskService");

const names: Record<string, string> = { nevio: "Nevio", anna: "Anna" };
const nameOf = (uid: string) => names[uid];

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    title: "Bad putzen",
    notes: "Spiegel",
    assigneeId: "nevio",
    dueDate: "2026-10-03",
    priority: "medium",
    status: "open",
    createdBy: "nevio",
    createdAt: new Date("2026-09-01T10:00:00Z"),
    updatedAt: new Date("2026-09-01T10:00:00Z"),
    hasPendingWrites: false,
    ...overrides,
  };
}

beforeEach(() => {
  fake.state.commits = [];
  fake.state.writes = [];
  fake.state.autoId = 0;
});

describe("createTask", () => {
  it("writes the task and «task_created» in one batch and returns the client id", async () => {
    const { id, committed } = createTask(
      "h1",
      { title: "Altpapier", assigneeId: "anna", dueDate: "2026-09-30", priority: "low" },
      "nevio",
    );
    await committed;
    expect(id).toBe("auto1");
    expect(fake.state.commits).toEqual([
      [
        {
          op: "set",
          path: "households/h1/tasks/auto1",
          data: {
            title: "Altpapier",
            assigneeId: "anna",
            dueDate: "2026-09-30",
            priority: "low",
            status: "open",
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
            type: "task_created",
            targetType: "task",
            targetId: "auto1",
            targetTitle: "Altpapier",
            createdAt: "SERVER_TIME",
          },
        },
      ],
    ]);
  });

  it("writes notes only when there are some", async () => {
    await createTask(
      "h1",
      { title: "Bad", notes: "Spiegel", assigneeId: null, dueDate: null, priority: "high" },
      "nevio",
    ).committed;
    expect(fake.state.commits[0][0].data).toMatchObject({
      notes: "Spiegel",
      assigneeId: null,
      dueDate: null,
    });
  });
});

describe("updateTask", () => {
  it("writes only the changed fields, without activity", async () => {
    await updateTask("h1", task(), { title: "Bad", priority: "high" }, "anna", nameOf);
    expect(fake.state.commits).toEqual([
      [
        {
          op: "update",
          path: "households/h1/tasks/t1",
          data: { title: "Bad", priority: "high", updatedAt: "SERVER_TIME" },
        },
      ],
    ]);
  });

  it("removes emptied notes with deleteField()", async () => {
    await updateTask("h1", task(), { notes: null }, "anna", nameOf);
    expect(fake.state.commits[0][0].data).toEqual({
      notes: "DELETE_FIELD",
      updatedAt: "SERVER_TIME",
    });
    await updateTask("h1", task({ notes: undefined }), { notes: "Neu" }, "anna", nameOf);
    expect(fake.state.commits[1][0].data).toEqual({ notes: "Neu", updatedAt: "SERVER_TIME" });
  });

  it("records «task_assigned» with name snapshots when the assignee changes", async () => {
    await updateTask("h1", task(), { assigneeId: "anna", title: "Bad" }, "nevio", nameOf);
    expect(fake.state.commits[0]).toEqual([
      {
        op: "update",
        path: "households/h1/tasks/t1",
        data: { assigneeId: "anna", title: "Bad", updatedAt: "SERVER_TIME" },
      },
      {
        op: "set",
        path: "households/h1/activity/auto1",
        data: {
          actorId: "nevio",
          type: "task_assigned",
          targetType: "task",
          targetId: "t1",
          targetTitle: "Bad",
          details: { fromId: "nevio", fromName: "Nevio", toId: "anna", toName: "Anna" },
          createdAt: "SERVER_TIME",
        },
      },
    ]);
  });

  it("uses null for «Niemand» and for unknown names", async () => {
    await updateTask("h1", task(), { assigneeId: null }, "nevio", nameOf);
    expect(fake.state.commits[0][1].data).toMatchObject({
      details: { fromId: "nevio", fromName: "Nevio", toId: null, toName: null },
    });
    await updateTask("h1", task({ assigneeId: "lea" }), { assigneeId: "anna" }, "nevio", nameOf);
    expect(fake.state.commits[1][1].data).toMatchObject({
      details: { fromId: "lea", fromName: null, toId: "anna", toName: "Anna" },
    });
  });

  it("does nothing without changes", async () => {
    await updateTask("h1", task(), {}, "nevio", nameOf);
    expect(fake.state.commits).toEqual([]);
  });
});

describe("completeTask / reopenTask / deleteTask", () => {
  it("completes with «task_completed» in one batch", async () => {
    await completeTask("h1", task(), "anna");
    expect(fake.state.commits).toEqual([
      [
        {
          op: "update",
          path: "households/h1/tasks/t1",
          data: {
            status: "done",
            completedAt: "SERVER_TIME",
            completedBy: "anna",
            updatedAt: "SERVER_TIME",
          },
        },
        {
          op: "set",
          path: "households/h1/activity/auto1",
          data: {
            actorId: "anna",
            type: "task_completed",
            targetType: "task",
            targetId: "t1",
            targetTitle: "Bad putzen",
            createdAt: "SERVER_TIME",
          },
        },
      ],
    ]);
  });

  it("reopens without activity, removing completedAt / completedBy", async () => {
    await reopenTask("h1", task({ status: "done" }));
    expect(fake.state.commits).toEqual([]);
    expect(fake.state.writes).toEqual([
      {
        op: "update",
        path: "households/h1/tasks/t1",
        data: {
          status: "open",
          completedAt: "DELETE_FIELD",
          completedBy: "DELETE_FIELD",
          updatedAt: "SERVER_TIME",
        },
      },
    ]);
  });

  it("deletes without activity", async () => {
    await deleteTask("h1", task());
    expect(fake.state.commits).toEqual([]);
    expect(fake.state.writes).toEqual([{ op: "delete", path: "households/h1/tasks/t1" }]);
  });
});
