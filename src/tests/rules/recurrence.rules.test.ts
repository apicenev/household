import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteField, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
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
  type TestUser,
} from "./helpers";

// Phase 4: recurrence, rotation, series ids and the household's rotationOrder (4.4).

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

const taskPath = (id: string) => ["households", HID, "tasks", id] as const;
const weeklySat = { freq: "weekly", interval: 1, byWeekday: [6] };
const rotation = { memberIds: [nevio.uid, anna.uid], index: 0 };

/** A new recurring task as taskService.createTask writes it. */
function newRecurring(user: TestUser, overrides: Record<string, unknown> = {}) {
  return {
    title: "Bad putzen",
    assigneeId: nevio.uid,
    dueDate: "2026-10-03",
    priority: "low",
    recurrence: weeklySat,
    rotation,
    seriesId: "ser1",
    seriesIndex: 1,
    status: "open",
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function without(data: Record<string, unknown>, ...keys: string[]) {
  const copy = { ...data };
  for (const key of keys) delete copy[key];
  return copy;
}

async function seedTask(id: string, overrides: Record<string, unknown> = {}) {
  await asAdmin(env, async (db) => {
    const now = new Date();
    await setDoc(doc(db, ...taskPath(id)), {
      title: "Bad putzen",
      assigneeId: nevio.uid,
      dueDate: "2026-10-03",
      priority: "low",
      status: "open",
      createdBy: nevio.uid,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    });
  });
}

const seedRecurring = (id: string, overrides: Record<string, unknown> = {}) =>
  seedTask(id, { recurrence: weeklySat, rotation, seriesId: "ser1", seriesIndex: 1, ...overrides });

const create = (user: TestUser, id: string, data: Record<string, unknown>) =>
  setDoc(doc(dbAs(env, user), ...taskPath(id)), data);

const update = (user: TestUser, id: string, data: Record<string, unknown>) =>
  updateDoc(doc(dbAs(env, user), ...taskPath(id)), { ...data, updatedAt: serverTimestamp() });

describe("recurring tasks: create", () => {
  it("a member creates a recurring task with rotation; the series id needn't be the task id", async () => {
    await assertSucceeds(create(anna, "t1", newRecurring(anna)));
  });

  it("every frequency tasks offer", async () => {
    const rules = [
      { freq: "daily", interval: 1 },
      { freq: "daily", interval: 52 },
      { freq: "weekly", interval: 2, byWeekday: [0, 3] },
      { freq: "monthly", interval: 1, byMonthDay: 31 },
      { freq: "yearly", interval: 1, byMonth: 2, byMonthDay: 29 },
    ];
    for (const [i, recurrence] of rules.entries()) {
      await assertSucceeds(
        create(anna, `t${i}`, without(newRecurring(anna, { recurrence }), "rotation")),
      );
    }
  });

  it("a recurring task needs a due date (RTK-02)", async () => {
    await assertFails(create(anna, "t1", newRecurring(anna, { dueDate: null })));
  });

  it("rejects bad rules", async () => {
    const bad = [
      { freq: "daily", interval: 0 },
      { freq: "daily", interval: 53 },
      { freq: "daily", interval: "2" },
      { freq: "hourly", interval: 1 },
      { freq: "daily" },
      { freq: "daily", interval: 1, byWeekday: [1] },
      { freq: "weekly", interval: 1 },
      { freq: "weekly", interval: 1, byWeekday: [] },
      { freq: "weekly", interval: 1, byWeekday: [7] },
      { freq: "weekly", interval: 1, byWeekday: [6, 6] },
      { freq: "monthly", interval: 2, byMonthDay: 3 },
      { freq: "monthly", interval: 1, byMonthDay: 32 },
      { freq: "monthly", interval: 1, byMonthDay: 3, bySetPos: 1 },
      { freq: "weekly", interval: 1, byWeekday: [6], until: "2026-12-31" },
      { freq: "weekly", interval: 1, byWeekday: [6], count: 10 },
      { freq: "yearly", interval: 1, byMonth: 13, byMonthDay: 1 },
      { freq: "yearly", interval: 1, byMonthDay: 1 },
    ];
    for (const recurrence of bad) {
      await assertFails(create(anna, "t1", newRecurring(anna, { recurrence })));
    }
  });

  it("rejects bad rotations", async () => {
    const bad = [
      { memberIds: [nevio.uid, lea.uid], index: 0 },
      { memberIds: [nevio.uid], index: 0 },
      { memberIds: [nevio.uid, nevio.uid, anna.uid], index: 0 },
      { memberIds: [nevio.uid, anna.uid], index: 2 },
      { memberIds: [nevio.uid, anna.uid], index: 1 }, // index points at Anna, assignee is Nevio
      { memberIds: [nevio.uid, anna.uid] },
      { memberIds: [nevio.uid, anna.uid], index: 0, extra: true },
    ];
    for (const value of bad) {
      await assertFails(create(anna, "t1", newRecurring(anna, { rotation: value })));
    }
  });

  it("no rotation and no series without a rule", async () => {
    await assertFails(create(anna, "t1", without(newRecurring(anna), "recurrence")));
    await assertFails(create(anna, "t1", without(newRecurring(anna), "recurrence", "rotation")));
    await assertFails(create(anna, "t1", without(newRecurring(anna), "seriesId", "seriesIndex")));
  });

  it("a generated occurrence has the id «{seriesId}-{seriesIndex}» (B5)", async () => {
    await assertSucceeds(create(anna, "ser1-2", newRecurring(anna, { seriesIndex: 2 })));
    await assertFails(create(anna, "other", newRecurring(anna, { seriesIndex: 2 })));
    await assertFails(create(anna, "ser1-3", newRecurring(anna, { seriesIndex: 2 })));
    await assertFails(create(anna, "ser1-0", newRecurring(anna, { seriesIndex: 0 })));
  });

  it("a set over an existing generated occurrence is rejected (B5)", async () => {
    await seedRecurring("ser1-2", { seriesIndex: 2 });
    await assertFails(create(anna, "ser1-2", newRecurring(anna, { seriesIndex: 2 })));
  });
});

describe("recurring tasks: edit", () => {
  it("changes the rule and turns the rotation with the assignee", async () => {
    await seedRecurring("t1");
    await assertSucceeds(update(anna, "t1", { recurrence: { freq: "daily", interval: 4 } }));
    await assertSucceeds(
      update(anna, "t1", {
        assigneeId: anna.uid,
        rotation: { memberIds: rotation.memberIds, index: 1 },
      }),
    );
  });

  it("the assignee can't leave the rotation's current member", async () => {
    await seedRecurring("t1");
    await assertFails(update(anna, "t1", { assigneeId: anna.uid }));
    await assertFails(update(anna, "t1", { assigneeId: null }));
  });

  it("rejects a bad rule or rotation in an edit", async () => {
    await seedRecurring("t1");
    await assertFails(update(anna, "t1", { recurrence: { freq: "weekly", interval: 1 } }));
    await assertFails(
      update(anna, "t1", { rotation: { memberIds: [nevio.uid, lea.uid], index: 0 } }),
    );
  });

  it("a recurring task keeps its due date", async () => {
    await seedRecurring("t1");
    await assertFails(update(anna, "t1", { dueDate: null }));
  });

  it("«Nie» ends the repeat with the rotation; dropping only the rule is rejected", async () => {
    await seedRecurring("t1");
    await assertFails(update(anna, "t1", { recurrence: deleteField() }));
    await assertSucceeds(
      update(anna, "t1", { recurrence: deleteField(), rotation: deleteField() }),
    );
  });

  it("a task that gets a rule starts a new series (B5)", async () => {
    await seedTask("t1", { seriesId: "old", seriesIndex: 1 });
    // Without a new series, or with the old series id: rejected.
    await assertFails(update(anna, "t1", { recurrence: weeklySat }));
    await assertFails(
      update(anna, "t1", { recurrence: weeklySat, seriesId: "old", seriesIndex: 1 }),
    );
    await assertFails(
      update(anna, "t1", { recurrence: weeklySat, seriesId: "ser2", seriesIndex: 2 }),
    );
    await assertSucceeds(
      update(anna, "t1", { recurrence: weeklySat, seriesId: "ser2", seriesIndex: 1 }),
    );
  });

  it("a series can't change while the rule stays", async () => {
    await seedRecurring("t1");
    await assertFails(update(anna, "t1", { seriesId: "ser9", seriesIndex: 1 }));
  });
});

describe("recurring tasks: complete and reopen", () => {
  it("a completed occurrence keeps its rule (B7)", async () => {
    await seedRecurring("t1");
    await assertSucceeds(
      update(anna, "t1", {
        status: "done",
        completedAt: serverTimestamp(),
        completedBy: anna.uid,
      }),
    );
  });

  it("reopen may drop the rule and rotation, never add them (B9)", async () => {
    const done = { status: "done", completedAt: new Date(), completedBy: nevio.uid };
    await seedRecurring("t1", done);
    await assertSucceeds(
      update(anna, "t1", {
        status: "open",
        completedAt: deleteField(),
        completedBy: deleteField(),
        recurrence: deleteField(),
        rotation: deleteField(),
      }),
    );

    await seedTask("t2", { ...done, seriesId: "ser1", seriesIndex: 1 });
    await assertFails(
      update(anna, "t2", {
        status: "open",
        completedAt: deleteField(),
        completedBy: deleteField(),
        recurrence: weeklySat,
      }),
    );
  });

  it("plain reopen of a completed occurrence keeps the rule", async () => {
    await seedRecurring("t1", { status: "done", completedAt: new Date(), completedBy: nevio.uid });
    await assertSucceeds(
      update(anna, "t1", {
        status: "open",
        completedAt: deleteField(),
        completedBy: deleteField(),
      }),
    );
  });
});

describe("household rotationOrder (HH-07)", () => {
  const household = (user: TestUser) => doc(dbAs(env, user), "households", HID);

  it("the owner sets it; members only, no duplicates", async () => {
    await assertSucceeds(
      updateDoc(household(nevio), {
        rotationOrder: [anna.uid, nevio.uid],
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(household(nevio), {
        rotationOrder: [anna.uid, lea.uid],
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(household(nevio), {
        rotationOrder: [anna.uid, anna.uid],
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("a member can't change it", async () => {
    await assertFails(
      updateDoc(household(anna), {
        rotationOrder: [anna.uid, nevio.uid],
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("a stale order (former member) doesn't block other settings", async () => {
    await asAdmin(env, (db) =>
      updateDoc(doc(db, "households", HID), { rotationOrder: [lea.uid, nevio.uid] }),
    );
    await assertSucceeds(
      updateDoc(household(nevio), { timeZone: "Europe/Berlin", updatedAt: serverTimestamp() }),
    );
  });
});
