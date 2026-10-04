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

const {
  completeRecurringTask,
  completeTask,
  createTask,
  deleteOccurrence,
  deleteSeries,
  deleteTask,
  reopenTask,
  updateTask,
} = await import("./taskService");

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

describe("recurring tasks (Phase 4)", () => {
  const weeklySat = { freq: "weekly" as const, interval: 1, byWeekday: [6] };
  const rotation = { memberIds: ["nevio", "anna"], index: 0 };
  const ctx = { today: "2026-10-04", weekStartsOn: 1 as const, memberIds: ["nevio", "anna"] };
  const recurring = (overrides: Partial<Task> = {}) =>
    task({ recurrence: weeklySat, rotation, seriesId: "s1", seriesIndex: 1, ...overrides });

  it("createTask starts a new series with a random id, not the task id (B5)", async () => {
    await createTask(
      "h1",
      {
        title: "Bad putzen",
        assigneeId: "nevio",
        dueDate: "2026-10-03",
        priority: "low",
        recurrence: weeklySat,
        rotation,
      },
      "nevio",
    ).committed;
    const [taskWrite] = fake.state.commits[0];
    expect(taskWrite.path).toBe("households/h1/tasks/auto1");
    expect(taskWrite.data).toMatchObject({
      recurrence: weeklySat,
      rotation,
      seriesId: "auto2",
      seriesIndex: 1,
    });
  });

  it("completing writes exactly 3 operations: done, next occurrence, «task_completed» (B7)", async () => {
    await completeTask("h1", recurring(), "anna", ctx);
    expect(fake.state.commits).toHaveLength(1);
    const ops = fake.state.commits[0];
    expect(ops).toHaveLength(3);
    expect(ops[0]).toEqual({
      op: "update",
      path: "households/h1/tasks/t1",
      data: {
        status: "done",
        completedAt: "SERVER_TIME",
        completedBy: "anna",
        updatedAt: "SERVER_TIME",
      },
    });
    expect(ops[1]).toEqual({
      op: "set",
      path: "households/h1/tasks/s1-2",
      data: {
        title: "Bad putzen",
        notes: "Spiegel",
        assigneeId: "anna",
        dueDate: "2026-10-10",
        priority: "medium",
        recurrence: weeklySat,
        rotation: { memberIds: ["nevio", "anna"], index: 1 },
        seriesId: "s1",
        seriesIndex: 2,
        status: "open",
        createdBy: "anna",
        createdAt: "SERVER_TIME",
        updatedAt: "SERVER_TIME",
      },
    });
    expect(ops[2]).toMatchObject({
      op: "set",
      data: { type: "task_completed", targetId: "t1", targetTitle: "Bad putzen", actorId: "anna" },
    });
  });

  it("completeTask refuses a recurring task without context", async () => {
    await expect(completeTask("h1", recurring(), "anna")).rejects.toThrow();
    expect(fake.state.commits).toHaveLength(0);
  });

  it("completeRecurringTask leaves out rotation and notes when there are none", async () => {
    await completeRecurringTask(
      "h1",
      recurring({ rotation: undefined, notes: undefined }),
      "nevio",
      ctx,
    );
    const next = fake.state.commits[0][1].data as Record<string, unknown>;
    expect(next.assigneeId).toBe("nevio");
    expect(next).not.toHaveProperty("rotation");
    expect(next).not.toHaveProperty("notes");
  });

  it("«Nur diese»: deletes and creates the next with the same assignee (B8)", async () => {
    await deleteOccurrence("h1", recurring(), "anna", ctx);
    const ops = fake.state.commits[0];
    expect(ops.map((op) => [op.op, op.path])).toEqual([
      ["delete", "households/h1/tasks/t1"],
      ["set", "households/h1/tasks/s1-2"],
    ]);
    expect(ops[1].data).toMatchObject({ assigneeId: "nevio", rotation, dueDate: "2026-10-10" });
  });

  it("«Ganze Serie»: deletes the open occurrence only", async () => {
    await deleteSeries("h1", recurring());
    expect(fake.state.writes).toEqual([{ op: "delete", path: "households/h1/tasks/t1" }]);
  });

  describe("reopenTask (RTK-10, B9)", () => {
    const done = recurring({ status: "done", completedAt: new Date(), completedBy: "nevio" });
    const generatedAt = new Date("2026-10-04T10:00:00Z");
    const next = (overrides: Partial<Task> = {}) =>
      recurring({
        id: "s1-2",
        seriesIndex: 2,
        createdAt: generatedAt,
        updatedAt: generatedAt,
        ...overrides,
      });

    it("with an untouched next occurrence: reopens and deletes it in one batch", async () => {
      await reopenTask("h1", done, [done, next()]);
      expect(fake.state.commits[0].map((op) => [op.op, op.path])).toEqual([
        ["update", "households/h1/tasks/t1"],
        ["delete", "households/h1/tasks/s1-2"],
      ]);
      expect(fake.state.commits[0][0].data).not.toHaveProperty("recurrence");
    });

    it("with an edited next occurrence: reopens as a normal task", async () => {
      await reopenTask("h1", done, [done, next({ updatedAt: new Date("2026-10-04T11:00:00Z") })]);
      expect(fake.state.commits).toHaveLength(0);
      expect(fake.state.writes).toEqual([
        {
          op: "update",
          path: "households/h1/tasks/t1",
          data: {
            status: "open",
            completedAt: "DELETE_FIELD",
            completedBy: "DELETE_FIELD",
            updatedAt: "SERVER_TIME",
            recurrence: "DELETE_FIELD",
            rotation: "DELETE_FIELD",
          },
        },
      ]);
    });

    it("without a next occurrence (series deleted): reopens as a normal task", async () => {
      await reopenTask("h1", done, [done]);
      expect(fake.state.writes[0].data).toMatchObject({ recurrence: "DELETE_FIELD" });
    });
  });

  describe("updateTask", () => {
    it("«Nie» removes rule and rotation (B6)", async () => {
      await updateTask("h1", recurring(), { recurrence: null }, "nevio", nameOf);
      expect(fake.state.commits[0][0].data).toEqual({
        recurrence: "DELETE_FIELD",
        rotation: "DELETE_FIELD",
        updatedAt: "SERVER_TIME",
      });
    });

    it("a task that gets a rule starts a new series, even with an old seriesId (B5)", async () => {
      const old = task({ seriesId: "old", seriesIndex: 1 });
      await updateTask("h1", old, { recurrence: weeklySat }, "nevio", nameOf);
      expect(fake.state.commits[0][0].data).toEqual({
        recurrence: weeklySat,
        seriesId: "auto1",
        seriesIndex: 1,
        updatedAt: "SERVER_TIME",
      });
    });

    it("changing the rule of a recurring task keeps the series", async () => {
      const daily = { freq: "daily" as const, interval: 4 };
      await updateTask("h1", recurring(), { recurrence: daily }, "nevio", nameOf);
      expect(fake.state.commits[0][0].data).toEqual({
        recurrence: daily,
        updatedAt: "SERVER_TIME",
      });
    });

    it("writes and removes the rotation", async () => {
      const turned = { memberIds: ["anna", "nevio"], index: 0 };
      await updateTask(
        "h1",
        recurring(),
        { rotation: turned, assigneeId: "anna" },
        "nevio",
        nameOf,
      );
      expect(fake.state.commits[0][0].data).toMatchObject({ rotation: turned, assigneeId: "anna" });
      await updateTask("h1", recurring(), { rotation: null }, "nevio", nameOf);
      expect(fake.state.commits[1][0].data).toEqual({
        rotation: "DELETE_FIELD",
        updatedAt: "SERVER_TIME",
      });
    });
  });
});
