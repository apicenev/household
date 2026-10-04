import { type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CalendarEvent,
  Household,
  ItemStat,
  ShoppingItem,
  Task,
  UserProfile,
} from "../../types";
import {
  DAY_MS,
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

// The real services, talking to the emulator as the current test user, so their batches
// are checked by the real rules.
const current = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("../../lib/firebase", () => ({
  get db() {
    return current.db;
  },
}));

const { createHousehold, updateHouseholdSettings } =
  await import("../../services/householdService");
const { getInvite, joinHousehold, regenerateInvite } = await import("../../services/inviteService");
const { updateMyProfile } = await import("../../services/memberService");
const { householdConverter } = await import("../../lib/converters/householdConverter");
const { listenToUserProfile } = await import("../../services/userService");
const { nextConfirmedHouseholdId } = await import("../../lib/auth/confirmedHouseholdId");
const {
  completeTask,
  createTask,
  deleteOccurrence,
  deleteTask,
  listenToTasks,
  reopenTask,
  updateTask,
} = await import("../../services/taskService");
const { taskConverter } = await import("../../lib/converters/taskConverter");
const {
  addItem,
  checkItem,
  clearCompleted,
  listenToItemStats,
  listenToItems,
  readdItem,
  restoreItems,
  uncheckItem,
} = await import("../../services/shoppingService");
const { createEvent, deleteEvent, listenToEvents, updateEvent } =
  await import("../../services/eventService");
const { allDayToStored } = await import("../../domain/eventTime");
const { normalizeParticipants } = await import("../../domain/calendar");

let env: RulesTestEnvironment;

function signInAs(user: TestUser): Firestore {
  const db = dbAs(env, user);
  current.db = db;
  return db;
}

function profileOf(user: TestUser, householdId?: string): UserProfile {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    initials: user.initials,
    avatarColor: user.avatarColor as UserProfile["avatarColor"],
    householdId,
    createdAt: new Date(2026, 8, 1),
  };
}

async function readHousehold(hid: string): Promise<Household> {
  let household: Household | undefined;
  await asAdmin(env, async (db) => {
    household = (await getDoc(doc(db, "households", hid).withConverter(householdConverter))).data();
  });
  if (!household) throw new Error(`household ${hid} missing`);
  return household;
}

async function adminData(path: string) {
  let data: Record<string, unknown> | undefined;
  await asAdmin(env, async (db) => {
    data = (await getDoc(doc(db, path))).data();
  });
  return data;
}

beforeAll(async () => {
  env = await createTestEnvironment();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedProfiles(env, nevio, anna, lea);
});

describe("services against the rules", () => {
  it("create → join → new code → settings → profile edits", async () => {
    signInAs(nevio);
    const hid = await createHousehold(profileOf(nevio), "Musterstrasse 12");
    let household = await readHousehold(hid);
    expect(household).toMatchObject({ ownerId: "nevio", memberIds: ["nevio"], weekStartsOn: 1 });
    expect(await adminData(`users/nevio`)).toMatchObject({ householdId: hid });

    signInAs(anna);
    const invite = await getInvite(household.inviteCode);
    expect(invite).toMatchObject({
      householdId: hid,
      householdName: "Musterstrasse 12",
      ownerName: "Nevio",
      memberCount: 1,
    });
    await joinHousehold(invite!, profileOf(anna));
    household = await readHousehold(hid);
    expect(household.memberIds).toEqual(["nevio", "anna"]);
    expect(await adminData(`invites/${household.inviteCode}`)).toMatchObject({ memberCount: 2 });
    const activity = await getDocs(
      collection(current.db as Firestore, "households", hid, "activity"),
    );
    expect(activity.docs.map((d) => d.data())).toMatchObject([
      { actorId: "anna", type: "member_joined", targetId: "anna", targetTitle: "Anna" },
    ]);

    signInAs(nevio);
    const oldCode = household.inviteCode;
    const newCode = await regenerateInvite(household, profileOf(nevio, hid));
    expect(newCode).not.toBe(oldCode);
    expect(await adminData(`invites/${oldCode}`)).toBeUndefined();
    household = await readHousehold(hid);
    expect(household.inviteCode).toBe(newCode);

    await updateHouseholdSettings(household, {
      name: "WG Linde",
      weekStartsOn: 0,
      timeZone: "Europe/Vienna",
    });
    household = await readHousehold(hid);
    expect(household).toMatchObject({ name: "WG Linde", weekStartsOn: 0 });
    expect(await adminData(`invites/${newCode}`)).toMatchObject({ householdName: "WG Linde" });

    await updateMyProfile(profileOf(nevio, hid), household, { displayName: "Nevio Apicella" });
    expect(await adminData(`households/${hid}/members/nevio`)).toMatchObject({
      displayName: "Nevio Apicella",
      initials: "NA",
    });
    expect(await adminData(`invites/${newCode}`)).toMatchObject({ ownerName: "Nevio Apicella" });

    signInAs(anna);
    await updateMyProfile(profileOf(anna, hid), household, { avatarColor: 2 });
    expect(await adminData(`households/${hid}/members/anna`)).toMatchObject({ avatarColor: 2 });
  });

  it("reports the old code after «Neuer Code» as not found", async () => {
    signInAs(nevio);
    const hid = await createHousehold(profileOf(nevio), "Musterstrasse 12");
    const household = await readHousehold(hid);

    signInAs(anna);
    const oldInvite = await getInvite(household.inviteCode);

    signInAs(nevio);
    await regenerateInvite(household, profileOf(nevio, hid));

    signInAs(anna);
    await expect(joinHousehold(oldInvite!, profileOf(anna))).rejects.toMatchObject({
      reason: "not-found",
    });
  });

  it("reports a code expired by server time even if the client thinks it's valid", async () => {
    signInAs(nevio);
    const hid = await createHousehold(profileOf(nevio), "Musterstrasse 12");
    const { inviteCode } = await readHousehold(hid);
    // Server: created 8 days ago (both copies, as always).
    const past = new Date(Date.now() - 8 * DAY_MS);
    await asAdmin(env, async (db) => {
      await updateDoc(doc(db, "households", hid), { inviteCreatedAt: past });
      await updateDoc(doc(db, "invites", inviteCode), { createdAt: past });
    });

    signInAs(anna);
    const invite = await getInvite(inviteCode);
    await expect(joinHousehold(invite!, profileOf(anna))).rejects.toMatchObject({
      reason: "expired",
    });

    // A client that still believes the code is fresh (wrong phone clock): the rules reject
    // the batch and the service maps that to «expired».
    vi.useFakeTimers({ now: past, toFake: ["Date"] });
    try {
      await expect(joinHousehold(invite!, profileOf(anna))).rejects.toMatchObject({
        reason: "expired",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports the new householdId as pending first, then confirmed (guards, §2.6)", async () => {
    signInAs(nevio);
    const seen: Array<{ householdId: string | null; pending: boolean }> = [];
    let confirmed: string | null | undefined;
    const stop = listenToUserProfile(
      nevio.uid,
      (profile, pending) => {
        seen.push({ householdId: profile?.householdId ?? null, pending });
        confirmed = nextConfirmedHouseholdId(confirmed, profile, pending);
      },
      (error) => {
        throw error;
      },
    );
    await vi.waitFor(() => expect(confirmed).toBeNull());

    const hid = await createHousehold(profileOf(nevio), "Musterstrasse 12");
    await vi.waitFor(() => expect(confirmed).toBe(hid));
    stop();

    // The local write showed up before the server confirmed it, and didn't count yet.
    const firstWithHousehold = seen.find((s) => s.householdId === hid);
    expect(firstWithHousehold).toEqual({ householdId: hid, pending: true });
    expect(seen.at(-1)).toEqual({ householdId: hid, pending: false });
  });

  it("denies a second household for the same user", async () => {
    signInAs(nevio);
    await createHousehold(profileOf(nevio), "Musterstrasse 12");
    await expect(createHousehold(profileOf(nevio), "Zweitwohnung")).rejects.toMatchObject({
      code: "permission-denied",
    });
  });
});

describe("task services against the rules", () => {
  const nameOf = (uid: string) => ({ nevio: "Nevio", anna: "Anna" })[uid];

  async function activityTypes(hid: string) {
    let types: string[] = [];
    await asAdmin(env, async (db) => {
      const snapshot = await getDocs(collection(db, "households", hid, "activity"));
      types = snapshot.docs
        .map((d) => d.data())
        .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis())
        .map((data) => data.type as string);
    });
    return types;
  }

  it("create → reassign → complete → reopen → delete; the other member sees it live", async () => {
    await seedHousehold(env, { members: [anna] });
    const hid = "h1";

    signInAs(anna);
    let seen: Task[] = [];
    const stop = listenToTasks(
      hid,
      (tasks) => {
        seen = tasks;
      },
      (error) => {
        throw error;
      },
    );

    signInAs(nevio);
    const { id, committed } = createTask(
      hid,
      {
        title: "Bad putzen",
        notes: "Spiegel",
        assigneeId: "nevio",
        dueDate: "2026-10-03",
        priority: "low",
      },
      "nevio",
    );
    await committed;
    await vi.waitFor(() => expect(seen.map((t) => t.title)).toEqual(["Bad putzen"]));

    const task = seen[0];
    await updateTask(hid, task, { assigneeId: "anna", notes: null, title: "Bad" }, "nevio", nameOf);
    await vi.waitFor(() => expect(seen[0]).toMatchObject({ title: "Bad", assigneeId: "anna" }));
    expect(seen[0].notes).toBeUndefined();

    signInAs(anna);
    await completeTask(hid, seen[0], "anna");
    await vi.waitFor(() => expect(seen[0]).toMatchObject({ status: "done", completedBy: "anna" }));
    await reopenTask(hid, seen[0]);
    await vi.waitFor(() => expect(seen[0].status).toBe("open"));
    expect(seen[0].completedAt).toBeUndefined();

    await deleteTask(hid, seen[0]);
    await vi.waitFor(() => expect(seen).toEqual([]));
    stop();

    expect(id).toBe(task.id);
    expect(await activityTypes(hid)).toEqual(["task_created", "task_assigned", "task_completed"]);
  });

  it("two members complete the same task: the second batch is rejected, one entry", async () => {
    await seedHousehold(env, { members: [anna] });
    const hid = "h1";
    signInAs(nevio);
    const { id, committed } = createTask(
      hid,
      { title: "Altpapier", assigneeId: null, dueDate: null, priority: "low" },
      "nevio",
    );
    await committed;
    const open: Task = {
      id,
      title: "Altpapier",
      assigneeId: null,
      dueDate: null,
      priority: "low",
      status: "open",
      createdBy: "nevio",
      createdAt: new Date(),
      updatedAt: new Date(),
      hasPendingWrites: false,
    };

    signInAs(anna);
    await completeTask(hid, open, "anna");
    signInAs(nevio);
    await expect(completeTask(hid, open, "nevio")).rejects.toMatchObject({
      code: "permission-denied",
    });
    expect((await activityTypes(hid)).filter((type) => type === "task_completed")).toHaveLength(1);
  });
});

describe("recurring task services against the rules (Phase 4)", () => {
  const hid = "h1";
  const weeklySat = { freq: "weekly" as const, interval: 1, byWeekday: [6] };
  const ctx = { today: "2026-10-04", weekStartsOn: 1 as const, memberIds: ["nevio", "anna"] };
  const nameOf = (uid: string) => ({ nevio: "Nevio", anna: "Anna" })[uid];

  async function readTasks(): Promise<Task[]> {
    let tasks: Task[] = [];
    await asAdmin(env, async (db) => {
      const snapshot = await getDocs(
        collection(db, "households", hid, "tasks").withConverter(taskConverter),
      );
      tasks = snapshot.docs.map((d) => d.data());
    });
    return tasks;
  }

  async function completions(): Promise<number> {
    let count = 0;
    await asAdmin(env, async (db) => {
      const snapshot = await getDocs(collection(db, "households", hid, "activity"));
      count = snapshot.docs.filter((d) => d.data().type === "task_completed").length;
    });
    return count;
  }

  async function createBathroom(): Promise<Task> {
    signInAs(nevio);
    const { id, committed } = createTask(
      hid,
      {
        title: "Bad putzen",
        assigneeId: "nevio",
        dueDate: "2026-10-03",
        priority: "low",
        recurrence: weeklySat,
        rotation: { memberIds: ["nevio", "anna"], index: 0 },
      },
      "nevio",
    );
    await committed;
    return (await readTasks()).find((t) => t.id === id)!;
  }

  beforeEach(async () => {
    await seedHousehold(env, { members: [anna] });
  });

  it("complete → next occurrence for Anna → undo restores the series (RTK-04/05/09/10)", async () => {
    const first = await createBathroom();
    expect(first.seriesId).not.toBe(first.id);

    signInAs(anna);
    await completeTask(hid, first, "anna", ctx);
    let tasks = await readTasks();
    const next = tasks.find((t) => t.id === `${first.seriesId}-2`)!;
    expect(next).toMatchObject({
      status: "open",
      assigneeId: "anna",
      dueDate: "2026-10-10",
      rotation: { memberIds: ["nevio", "anna"], index: 1 },
      seriesIndex: 2,
    });
    const done = tasks.find((t) => t.id === first.id)!;
    expect(done).toMatchObject({ status: "done", recurrence: weeklySat });
    expect(await completions()).toBe(1);

    await reopenTask(hid, done, tasks);
    tasks = await readTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ id: first.id, status: "open", recurrence: weeklySat });
  });

  it("reopen after the next was edited → normal task → a new rule works (old-series regression)", async () => {
    const first = await createBathroom();
    signInAs(anna);
    await completeTask(hid, first, "anna", ctx);
    let tasks = await readTasks();
    const next = tasks.find((t) => t.id === `${first.seriesId}-2`)!;
    await updateTask(hid, next, { title: "Bad gründlich putzen" }, "anna", nameOf);

    tasks = await readTasks();
    await reopenTask(
      hid,
      tasks.find((t) => t.id === first.id)!,
      tasks,
    );
    let reopened = (await readTasks()).find((t) => t.id === first.id)!;
    expect(reopened.status).toBe("open");
    expect(reopened.recurrence).toBeUndefined();
    expect(reopened.seriesId).toBe(first.seriesId);

    // Same series id again would collide with «{seriesId}-2»; the service starts a new one.
    await updateTask(hid, reopened, { recurrence: weeklySat }, "anna", nameOf);
    reopened = (await readTasks()).find((t) => t.id === first.id)!;
    expect(reopened.seriesId).not.toBe(first.seriesId);
    await completeTask(hid, reopened, "anna", ctx);
    expect((await readTasks()).some((t) => t.id === `${reopened.seriesId}-2`)).toBe(true);
  });

  it("two members complete the same occurrence: isComplete rejects the second", async () => {
    const first = await createBathroom();
    signInAs(anna);
    await completeTask(hid, first, "anna", ctx);
    signInAs(nevio);
    await expect(completeTask(hid, first, "nevio", ctx)).rejects.toMatchObject({
      code: "permission-denied",
    });
    expect((await readTasks()).filter((t) => t.status === "open")).toHaveLength(1);
    expect(await completions()).toBe(1);
  });

  it("two «Nur diese», and completion + «Nur diese»: one next occurrence (fixed id, B5)", async () => {
    const first = await createBathroom();
    signInAs(anna);
    await deleteOccurrence(hid, first, "anna", ctx);
    signInAs(nevio);
    await expect(deleteOccurrence(hid, first, "nevio", ctx)).rejects.toMatchObject({
      code: "permission-denied",
    });
    let tasks = await readTasks();
    expect(tasks.map((t) => t.id)).toEqual([`${first.seriesId}-2`]);
    expect(tasks[0].assigneeId).toBe("nevio");

    const second = tasks[0];
    signInAs(anna);
    await completeTask(hid, second, "anna", ctx);
    signInAs(nevio);
    await expect(deleteOccurrence(hid, second, "nevio", ctx)).rejects.toMatchObject({
      code: "permission-denied",
    });
    tasks = await readTasks();
    expect(tasks.filter((t) => t.status === "open").map((t) => t.id)).toEqual([
      `${first.seriesId}-3`,
    ]);
    expect(tasks.find((t) => t.id === second.id)?.status).toBe("done");
  });

  it("the owner saves a rotation order through updateHouseholdSettings", async () => {
    signInAs(nevio);
    const household = await readHousehold(hid);
    await updateHouseholdSettings(household, { rotationOrder: ["anna", "nevio"] });
    expect((await readHousehold(hid)).rotationOrder).toEqual(["anna", "nevio"]);
  });
});

describe("shopping services against the rules (Phase 5)", () => {
  const hid = "h1";

  beforeEach(async () => {
    await seedHousehold(env, { members: [anna] });
  });

  /** Live items and stats as Anna's provider would see them. */
  function watch() {
    const live = { items: [] as ShoppingItem[], stats: [] as ItemStat[] };
    signInAs(anna);
    const fail = (error: Error) => {
      throw error;
    };
    const stopItems = listenToItems(hid, (items) => (live.items = items), fail);
    const stopStats = listenToItemStats(hid, (stats) => (live.stats = stats), fail);
    return { live, stop: () => (stopItems(), stopStats()) };
  }

  const milkCount = (stats: ItemStat[]) => stats.find((s) => s.key === "milch")?.count;

  it("add → check → uncheck → check → re-add → check → clear → restore (B4, B6, B7)", async () => {
    const { live, stop } = watch();

    signInAs(nevio);
    const { id, committed } = addItem(hid, { name: " Milch ", category: "groceries" }, "nevio");
    await committed;
    await vi.waitFor(() => expect(live.items.map((i) => i.name)).toEqual(["Milch"]));

    signInAs(anna);
    await checkItem(hid, live.items[0], "anna");
    await vi.waitFor(() => expect(milkCount(live.stats)).toBe(1));
    expect(live.items[0]).toMatchObject({ checked: true, checkedBy: "anna" });

    await uncheckItem(hid, live.items[0], live.stats[0]);
    await vi.waitFor(() => expect(milkCount(live.stats)).toBe(0));
    expect(live.items[0].checked).toBe(false);

    await checkItem(hid, live.items[0], "anna");
    await vi.waitFor(() => expect(milkCount(live.stats)).toBe(1));
    await vi.waitFor(() => expect(live.items[0].checked).toBe(true));

    // Re-add from the bar: new id, old one gone, stats untouched.
    signInAs(nevio);
    const readd = readdItem(hid, live.items[0], "nevio");
    await readd.committed;
    await vi.waitFor(() => expect(live.items.map((i) => i.id)).toEqual([readd.id]));
    expect(readd.id).not.toBe(id);
    expect(live.items[0]).toMatchObject({ checked: false, createdBy: "nevio" });
    expect(milkCount(live.stats)).toBe(1);

    signInAs(anna);
    await checkItem(hid, live.items[0], "anna");
    await vi.waitFor(() => expect(milkCount(live.stats)).toBe(2));
    await vi.waitFor(() => expect(live.items[0].checked).toBe(true));

    // Clear (as Nevio, who didn't buy it), stats stay; restore brings the item back as it was.
    signInAs(nevio);
    const cleared = clearCompleted(hid, live.items);
    await cleared.committed;
    await vi.waitFor(() => expect(live.items).toEqual([]));
    expect(milkCount(live.stats)).toBe(2);
    await restoreItems(hid, cleared.removed);
    await vi.waitFor(() =>
      expect(live.items[0]).toMatchObject({ id: readd.id, checked: true, checkedBy: "anna" }),
    );
    stop();

    const types: string[] = [];
    await asAdmin(env, async (db) => {
      const snapshot = await getDocs(collection(db, "households", hid, "activity"));
      types.push(...snapshot.docs.map((d) => d.data().type as string).sort());
    });
    expect(types).toEqual([
      "item_added",
      "item_added",
      "item_purchased",
      "item_purchased",
      "item_purchased",
    ]);
  });

  it("unchecks an item without a stats doc (seeded, B6)", async () => {
    await asAdmin(env, async (db) => {
      const now = new Date();
      await setDoc(doc(db, "households", hid, "shoppingItems", "oil"), {
        name: "Olivenöl",
        category: "groceries",
        checked: true,
        checkedAt: now,
        checkedBy: "nevio",
        createdBy: "nevio",
        createdAt: now,
        updatedAt: now,
      });
    });
    const { live, stop } = watch();
    await vi.waitFor(() => expect(live.items).toHaveLength(1));
    // The provider knows no stats doc, so no stats write is even sent.
    await uncheckItem(hid, live.items[0], undefined);
    await vi.waitFor(() => expect(live.items[0].checked).toBe(false));
    // And a stale count of 1 for a missing doc: the −1 is rejected, the uncheck still stands.
    await checkItem(hid, live.items[0], "anna");
    await vi.waitFor(() => expect(live.items[0].checked).toBe(true));
    await asAdmin(env, (db) => deleteDoc(doc(db, "households", hid, "itemStats", "olivenöl")));
    await expect(
      uncheckItem(hid, live.items[0], {
        key: "olivenöl",
        name: "Olivenöl",
        category: "groceries",
        count: 1,
        lastPurchasedAt: new Date(),
      }),
    ).resolves.toBeUndefined();
    await vi.waitFor(() => expect(live.items[0].checked).toBe(false));
    stop();
  });
});

describe("event services against the rules (Phase 6)", () => {
  const hid = "h1";

  beforeEach(async () => {
    await seedHousehold(env, { members: [anna] });
  });

  /** Live events as Anna's provider would see them. */
  function watch() {
    const live = { events: [] as CalendarEvent[] };
    signInAs(anna);
    const stop = listenToEvents(
      hid,
      (events) => (live.events = events),
      (error) => {
        throw error;
      },
    );
    return { live, stop };
  }

  it("create → activity → edit → delete; the other member sees it live (B12)", async () => {
    const { live, stop } = watch();

    signInAs(nevio);
    const { id, committed } = createEvent(
      hid,
      {
        title: " Ferien ",
        description: "Lissabon.",
        category: "travel",
        allDay: true,
        ...allDayToStored("2026-10-14", "2026-10-21"),
        participants: "household",
      },
      "nevio",
    );
    await committed;
    await vi.waitFor(() => expect(live.events.map((e) => e.title)).toEqual(["Ferien"]));
    expect(live.events[0]).toMatchObject({ id, allDay: true, createdBy: "nevio" });
    expect(live.events[0].start.toISOString()).toBe("2026-10-14T00:00:00.000Z");

    signInAs(anna);
    await updateEvent(hid, id, { description: null, participants: ["anna"] });
    await vi.waitFor(() => expect(live.events[0].participants).toEqual(["anna"]));
    expect(live.events[0].description).toBeUndefined();

    await deleteEvent(hid, id);
    await vi.waitFor(() => expect(live.events).toEqual([]));
    stop();

    const entries: Record<string, unknown>[] = [];
    await asAdmin(env, async (db) => {
      const snapshot = await getDocs(collection(db, "households", hid, "activity"));
      entries.push(...snapshot.docs.map((d) => d.data()));
    });
    expect(entries).toEqual([
      expect.objectContaining({
        type: "event_created",
        targetType: "event",
        targetId: id,
        targetTitle: "Ferien",
        actorId: "nevio",
      }),
    ]);
  });

  it("an edit that still lists a former member is denied; normalized participants pass (B5)", async () => {
    await asAdmin(env, async (db) => {
      const now = new Date();
      await setDoc(doc(db, "households", hid, "events", "doctor"), {
        title: "Arzttermin",
        category: "appointment",
        allDay: false,
        start: new Date("2026-10-06T06:15:00Z"),
        end: new Date("2026-10-06T07:00:00Z"),
        participants: ["anna", "gone"],
        createdBy: "anna",
        createdAt: now,
        updatedAt: now,
      });
    });
    signInAs(nevio);
    await expect(updateEvent(hid, "doctor", { title: "Arzt" })).rejects.toThrow();
    // normalizeParticipants only reads the uids.
    const members = [{ uid: "nevio" }, { uid: "anna" }] as unknown as Parameters<
      typeof normalizeParticipants
    >[1];
    await expect(
      updateEvent(hid, "doctor", {
        title: "Arzt",
        participants: normalizeParticipants(["anna", "gone"], members),
      }),
    ).resolves.toBeUndefined();
  });
});
