import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  HID,
  anna,
  asAdmin,
  createTestEnvironment,
  dbAs,
  lea,
  nevio,
  seedHousehold,
  seedProfiles,
  unauthenticatedDb,
  type TestUser,
} from "./helpers";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createTestEnvironment();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedProfiles(env, lea);
  await seedHousehold(env, { members: [anna] });
});

const taskPath = (id = "t1") => ["households", HID, "tasks", id] as const;

/** A new task as taskService.createTask writes it. */
function newTask(user: TestUser, overrides: Record<string, unknown> = {}) {
  return {
    title: "Bad putzen",
    assigneeId: null,
    dueDate: "2026-10-03",
    priority: "low",
    status: "open",
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

/** Seeds a task directly (bypassing the rules). */
async function seedTask(id = "t1", overrides: Record<string, unknown> = {}) {
  await asAdmin(env, async (db) => {
    const now = new Date();
    await setDoc(doc(db, ...taskPath(id)), {
      title: "Bad putzen",
      notes: "Spiegel",
      assigneeId: nevio.uid,
      dueDate: "2026-10-03",
      priority: "medium",
      status: "open",
      createdBy: nevio.uid,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    });
  });
}

const completion = (user: TestUser) => ({
  status: "done",
  completedAt: serverTimestamp(),
  completedBy: user.uid,
  updatedAt: serverTimestamp(),
});

const reopening = () => ({
  status: "open",
  completedAt: deleteField(),
  completedBy: deleteField(),
  updatedAt: serverTimestamp(),
});

function activity(user: TestUser, overrides: Record<string, unknown> = {}) {
  return {
    actorId: user.uid,
    type: "task_created",
    targetType: "task",
    targetId: "t1",
    targetTitle: "Bad putzen",
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

function activityDoc(db: Firestore) {
  return doc(collection(db, "households", HID, "activity"));
}

describe("tasks: access", () => {
  it("members read and list, others don't", async () => {
    await seedTask();
    await assertSucceeds(getDoc(doc(dbAs(env, anna), ...taskPath())));
    await assertSucceeds(getDocs(collection(dbAs(env, nevio), "households", HID, "tasks")));
    await assertFails(getDoc(doc(dbAs(env, lea), ...taskPath())));
    await assertFails(getDocs(collection(dbAs(env, lea), "households", HID, "tasks")));
    await assertFails(getDoc(doc(unauthenticatedDb(env), ...taskPath())));
  });

  it("non-members and signed-out users can't write", async () => {
    await seedTask();
    const db = dbAs(env, lea);
    await assertFails(setDoc(doc(db, ...taskPath("t2")), newTask(lea)));
    await assertFails(
      updateDoc(doc(db, ...taskPath()), { title: "X", updatedAt: serverTimestamp() }),
    );
    await assertFails(updateDoc(doc(db, ...taskPath()), completion(lea)));
    await assertFails(deleteDoc(doc(db, ...taskPath())));
    await assertFails(setDoc(doc(unauthenticatedDb(env), ...taskPath("t2")), newTask(nevio)));
  });
});

describe("tasks: create", () => {
  it("creates with minimal and full fields", async () => {
    const db = dbAs(env, anna);
    await assertSucceeds(setDoc(doc(db, ...taskPath("t1")), newTask(anna, { dueDate: null })));
    await assertSucceeds(
      setDoc(
        doc(db, ...taskPath("t2")),
        newTask(anna, { notes: "Spiegel", assigneeId: nevio.uid, priority: "high" }),
      ),
    );
  });

  it("validates the title", async () => {
    const db = dbAs(env, anna);
    for (const title of ["", "   ", "x".repeat(201), 42]) {
      await assertFails(setDoc(doc(db, ...taskPath()), newTask(anna, { title })));
    }
    await assertSucceeds(setDoc(doc(db, ...taskPath()), newTask(anna, { title: "x".repeat(200) })));
  });

  it("validates notes, priority, status and due date", async () => {
    const db = dbAs(env, anna);
    const fails = [
      { notes: "x".repeat(2001) },
      { notes: "" },
      { priority: "none" },
      { priority: "urgent" },
      { status: "later" },
      { dueDate: "3.10.2026" },
      { dueDate: "2026-13-45" },
      { dueDate: "2026-10-3" },
    ];
    for (const overrides of fails) {
      await assertFails(setDoc(doc(db, ...taskPath()), newTask(anna, overrides)));
    }
    const withoutPriority: Record<string, unknown> = newTask(anna);
    delete withoutPriority.priority;
    await assertFails(setDoc(doc(db, ...taskPath()), withoutPriority));
  });

  it("requires a member as assignee", async () => {
    const db = dbAs(env, anna);
    await assertFails(setDoc(doc(db, ...taskPath()), newTask(anna, { assigneeId: lea.uid })));
    await assertSucceeds(setDoc(doc(db, ...taskPath()), newTask(anna, { assigneeId: anna.uid })));
  });

  it("requires own createdBy, server times, status open and no extra keys", async () => {
    const db = dbAs(env, anna);
    const fails = [
      { createdBy: nevio.uid },
      { createdAt: new Date() },
      { updatedAt: new Date() },
      { status: "done", completedAt: serverTimestamp(), completedBy: anna.uid },
      { recurrence: { freq: "weekly", interval: 1 } },
      { seriesId: "s1" },
    ];
    for (const overrides of fails) {
      await assertFails(setDoc(doc(db, ...taskPath()), newTask(anna, overrides)));
    }
  });
});

describe("tasks: edit", () => {
  it("edits any field of any task", async () => {
    await seedTask();
    const db = dbAs(env, anna);
    await assertSucceeds(
      updateDoc(doc(db, ...taskPath()), {
        title: "Bad",
        assigneeId: anna.uid,
        dueDate: null,
        priority: "high",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(db, ...taskPath()), { notes: deleteField(), updatedAt: serverTimestamp() }),
    );
  });

  it("validates changed fields and keeps the rest", async () => {
    await seedTask();
    const db = dbAs(env, anna);
    const fails = [
      { title: "" },
      { assigneeId: lea.uid },
      { dueDate: "2026-02-30x" },
      { priority: "none" },
      { createdBy: anna.uid },
      { createdAt: new Date() },
      { status: "done" },
    ];
    for (const overrides of fails) {
      await assertFails(
        updateDoc(doc(db, ...taskPath()), { ...overrides, updatedAt: serverTimestamp() }),
      );
    }
    await assertFails(updateDoc(doc(db, ...taskPath()), { title: "Bad", updatedAt: new Date() }));
  });

  it("keeps a task of someone who left editable", async () => {
    await seedTask("t1", { assigneeId: lea.uid });
    await assertSucceeds(
      updateDoc(doc(dbAs(env, anna), ...taskPath()), {
        title: "Bad",
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe("tasks: complete / reopen / delete", () => {
  it("completes with own completedBy and server time", async () => {
    await seedTask();
    await assertSucceeds(updateDoc(doc(dbAs(env, anna), ...taskPath()), completion(anna)));
  });

  it("denies a completion by someone else, with client time or other changes", async () => {
    await seedTask();
    const db = dbAs(env, anna);
    await assertFails(updateDoc(doc(db, ...taskPath()), completion(nevio)));
    await assertFails(
      updateDoc(doc(db, ...taskPath()), { ...completion(anna), completedAt: new Date() }),
    );
    await assertFails(updateDoc(doc(db, ...taskPath()), { ...completion(anna), title: "X" }));
  });

  it("denies completing a task that is already done", async () => {
    await seedTask("t1", { status: "done", completedAt: new Date(), completedBy: nevio.uid });
    await assertFails(updateDoc(doc(dbAs(env, anna), ...taskPath()), completion(anna)));
  });

  it("reopens, removing completedAt and completedBy", async () => {
    await seedTask("t1", { status: "done", completedAt: new Date(), completedBy: nevio.uid });
    const db = dbAs(env, anna);
    await assertFails(
      updateDoc(doc(db, ...taskPath()), { status: "open", updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(updateDoc(doc(db, ...taskPath()), reopening()));
    // A second reopen only touches updatedAt, which is a (harmless) edit.
    await assertFails(updateDoc(doc(db, ...taskPath()), { ...reopening(), status: "done" }));
  });

  it("any member deletes", async () => {
    await seedTask();
    await assertSucceeds(deleteDoc(doc(dbAs(env, anna), ...taskPath())));
  });
});

describe("activity: task entries", () => {
  it("records create, completion and reassignment in the same batch", async () => {
    const db = dbAs(env, anna);
    const create = writeBatch(db);
    create.set(doc(db, ...taskPath()), newTask(anna));
    create.set(activityDoc(db), activity(anna));
    await assertSucceeds(create.commit());

    const assign = writeBatch(db);
    assign.update(doc(db, ...taskPath()), {
      assigneeId: nevio.uid,
      title: "Bad",
      updatedAt: serverTimestamp(),
    });
    assign.set(
      activityDoc(db),
      activity(anna, {
        type: "task_assigned",
        targetTitle: "Bad",
        details: { fromId: null, fromName: null, toId: nevio.uid, toName: "Nevio" },
      }),
    );
    await assertSucceeds(assign.commit());

    const complete = writeBatch(db);
    complete.update(doc(db, ...taskPath()), completion(anna));
    complete.set(activityDoc(db), activity(anna, { type: "task_completed", targetTitle: "Bad" }));
    await assertSucceeds(complete.commit());
  });

  it("denies a wrong target type, a missing task or a wrong title snapshot", async () => {
    await seedTask();
    const db = dbAs(env, anna);
    await assertFails(setDoc(activityDoc(db), activity(anna, { targetType: "member" })));
    await assertFails(setDoc(activityDoc(db), activity(anna, { targetId: "missing" })));
    await assertFails(setDoc(activityDoc(db), activity(anna, { targetTitle: "Küche" })));
    await assertSucceeds(setDoc(activityDoc(db), activity(anna)));
  });

  it("denies «task_completed» while the task stays open", async () => {
    await seedTask();
    await assertFails(
      setDoc(activityDoc(dbAs(env, anna)), activity(anna, { type: "task_completed" })),
    );
  });

  it("checks details: none on create / complete, typed on reassignment", async () => {
    await seedTask();
    const db = dbAs(env, anna);
    const assigned = (details: unknown) =>
      setDoc(activityDoc(db), activity(anna, { type: "task_assigned", details }));
    await assertFails(setDoc(activityDoc(db), activity(anna, { details: { a: 1 } })));
    await assertFails(setDoc(activityDoc(db), activity(anna, { type: "task_assigned" })));
    await assertFails(assigned({ fromId: "nevio", fromName: "Nevio", toId: "anna" }));
    await assertFails(assigned({ fromId: 1, fromName: "Nevio", toId: "anna", toName: "Anna" }));
    await assertFails(
      assigned({ fromId: "nevio", fromName: "Nevio", toId: "anna", toName: "Anna", x: 1 }),
    );
    await assertSucceeds(
      assigned({ fromId: "nevio", fromName: "Nevio", toId: null, toName: null }),
    );
  });

  it("denies task entries by non-members and for someone else", async () => {
    await seedTask();
    await assertFails(setDoc(activityDoc(dbAs(env, lea)), activity(lea)));
    await assertFails(setDoc(activityDoc(dbAs(env, anna)), activity(nevio)));
  });

  it("entries stay append-only", async () => {
    await seedTask();
    const db = dbAs(env, anna);
    const ref = activityDoc(db);
    await assertSucceeds(setDoc(ref, activity(anna)));
    await assertFails(updateDoc(ref, { targetTitle: "X" }));
    await assertFails(deleteDoc(ref));
  });
});
