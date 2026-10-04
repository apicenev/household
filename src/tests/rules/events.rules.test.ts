import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  Timestamp,
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
  DAY_MS,
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

const eventPath = (id = "e1") => ["households", HID, "events", id] as const;

const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

/** A timed event as eventService.createEvent writes it (Fr., 2. Okt. 19:30–22:30). */
function newEvent(user: TestUser, overrides: Record<string, unknown> = {}) {
  return {
    title: "Znacht mit Freunden",
    category: "social",
    allDay: false,
    start: ts("2026-10-02T17:30:00Z"),
    end: ts("2026-10-02T20:30:00Z"),
    participants: "household",
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

/** An all-day event from the first to the last day (inclusive, 00:00 UTC, B2). */
function allDay(first: string, last: string) {
  return { allDay: true, start: ts(`${first}T00:00:00Z`), end: ts(`${last}T00:00:00Z`) };
}

/** A timed event of exactly `days` days (plus `extraMs`). */
function timedDays(days: number, extraMs = 0) {
  const start = new Date("2026-01-01T09:00:00Z");
  return {
    start: Timestamp.fromDate(start),
    end: Timestamp.fromDate(new Date(start.getTime() + days * DAY_MS + extraMs)),
  };
}

function create(db: Firestore, data: Record<string, unknown>, id = "e1") {
  return setDoc(doc(db, ...eventPath(id)), data);
}

/** Seeds an event directly (bypassing the rules). */
async function seedEvent(id = "e1", overrides: Record<string, unknown> = {}) {
  await asAdmin(env, async (db) => {
    const now = new Date();
    await setDoc(doc(db, ...eventPath(id)), {
      title: "Arzttermin",
      description: "Jährliche Kontrolle.",
      category: "appointment",
      allDay: false,
      start: new Date("2026-10-06T06:15:00Z"),
      end: new Date("2026-10-06T07:00:00Z"),
      participants: [anna.uid],
      createdBy: anna.uid,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    });
  });
}

/** The create batch as eventService.createEvent writes it. */
function createBatch(
  db: Firestore,
  user: TestUser,
  options: { event?: Record<string, unknown>; activity?: Record<string, unknown> } = {},
) {
  const batch = writeBatch(db);
  batch.set(doc(db, ...eventPath()), newEvent(user, options.event));
  batch.set(doc(collection(db, "households", HID, "activity")), {
    actorId: user.uid,
    type: "event_created",
    targetType: "event",
    targetId: "e1",
    targetTitle: "Znacht mit Freunden",
    createdAt: serverTimestamp(),
    ...options.activity,
  });
  return batch;
}

describe("events: access", () => {
  it("non-members can't read, create, update or delete", async () => {
    await seedEvent();
    const db = dbAs(env, lea);
    await assertFails(getDoc(doc(db, ...eventPath())));
    await assertFails(getDocs(collection(db, "households", HID, "events")));
    await assertFails(create(db, newEvent(lea), "e2"));
    await assertFails(updateDoc(doc(db, ...eventPath()), { title: "Weg" }));
    await assertFails(deleteDoc(doc(db, ...eventPath())));
  });

  it("members read and list", async () => {
    await seedEvent();
    const db = dbAs(env, nevio);
    await assertSucceeds(getDoc(doc(db, ...eventPath())));
    await assertSucceeds(getDocs(collection(db, "households", HID, "events")));
  });
});

describe("events: create", () => {
  it("allows a timed, an all-day and a multi-day event", async () => {
    const db = dbAs(env, nevio);
    await assertSucceeds(create(db, newEvent(nevio), "timed"));
    await assertSucceeds(
      create(db, newEvent(nevio, { ...allDay("2026-10-01", "2026-10-01") }), "oneDay"),
    );
    await assertSucceeds(
      create(
        db,
        newEvent(nevio, {
          title: "Ferien",
          description: "Lissabon.",
          category: "travel",
          ...allDay("2026-10-14", "2026-10-21"),
          participants: [nevio.uid, anna.uid],
        }),
        "trip",
      ),
    );
  });

  it("allows an end equal to the start (a reminder without duration)", async () => {
    const at = ts("2026-10-02T07:00:00Z");
    await assertSucceeds(create(dbAs(env, nevio), newEvent(nevio, { start: at, end: at })));
  });

  it("allows exactly 366 days and denies 367, for timed and all-day events (B3)", async () => {
    const db = dbAs(env, nevio);
    await assertSucceeds(create(db, newEvent(nevio, timedDays(366)), "t366"));
    await assertFails(create(db, newEvent(nevio, timedDays(366, 1000)), "t367"));
    // 1 Jan 2026 … 1 Jan 2027 = 366 calendar days (end − start = 365 days).
    await assertSucceeds(create(db, newEvent(nevio, allDay("2026-01-01", "2027-01-01")), "a366"));
    await assertFails(create(db, newEvent(nevio, allDay("2026-01-01", "2027-01-02")), "a367"));
  });

  it("denies an end before the start", async () => {
    const db = dbAs(env, nevio);
    await assertFails(
      create(
        db,
        newEvent(nevio, { start: ts("2026-10-02T17:30:00Z"), end: ts("2026-10-02T17:00:00Z") }),
      ),
    );
    await assertFails(create(db, newEvent(nevio, allDay("2026-10-02", "2026-10-01"))));
  });

  it("denies all-day times that aren't at 00:00 UTC", async () => {
    await assertFails(
      create(
        dbAs(env, nevio),
        newEvent(nevio, {
          allDay: true,
          start: ts("2026-10-01T22:00:00Z"),
          end: ts("2026-10-01T22:00:00Z"),
        }),
      ),
    );
  });

  it("denies invalid fields", async () => {
    const db = dbAs(env, nevio);
    const denied = [
      { category: "work" },
      { title: "" },
      { title: "x".repeat(201) },
      { title: " Znacht" },
      { title: "Znacht " },
      { description: "" },
      { description: "x".repeat(2001) },
      { allDay: "no" },
      { start: "2026-10-02" },
      { participants: [] },
      { participants: [anna.uid, anna.uid] },
      { participants: [lea.uid] },
      { participants: "everyone" },
      { recurrence: { freq: "weekly", interval: 2 } },
      { exceptions: [] },
      { createdBy: anna.uid },
      { createdAt: ts("2026-09-01T10:00:00Z") },
      { updatedAt: ts("2026-09-01T10:00:00Z") },
    ];
    for (const [index, overrides] of denied.entries()) {
      await assertFails(create(db, newEvent(nevio, overrides), `bad${index}`));
    }
  });

  it("allows a title of 200 characters and 2000 characters of description", async () => {
    await assertSucceeds(
      create(
        dbAs(env, nevio),
        newEvent(nevio, { title: "x".repeat(200), description: "y".repeat(2000) }),
      ),
    );
  });
});

describe("events: update and delete", () => {
  it("any member edits; createdBy and createdAt stay, updatedAt is server time", async () => {
    await seedEvent();
    const db = dbAs(env, nevio);
    await assertSucceeds(
      updateDoc(doc(db, ...eventPath()), {
        title: "Arzt",
        description: deleteField(),
        category: "other",
        participants: "household",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(db, ...eventPath()), { createdBy: nevio.uid, updatedAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(doc(db, ...eventPath()), {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(updateDoc(doc(db, ...eventPath()), { title: "Ohne Zeit" }));
  });

  it("checks the whole event: an edit that still lists a former member is denied (B5)", async () => {
    await seedEvent("e1", { participants: [anna.uid, "gone"] });
    const db = dbAs(env, nevio);
    await assertFails(
      updateDoc(doc(db, ...eventPath()), { title: "Arzt", updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(
      updateDoc(doc(db, ...eventPath()), {
        title: "Arzt",
        participants: [anna.uid],
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("an edit can't make the times invalid", async () => {
    await seedEvent();
    await assertFails(
      updateDoc(doc(dbAs(env, nevio), ...eventPath()), {
        end: ts("2026-10-06T06:00:00Z"),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("any member deletes", async () => {
    await seedEvent();
    await assertSucceeds(deleteDoc(doc(dbAs(env, nevio), ...eventPath())));
  });
});

describe("events: activity (B12)", () => {
  it("accepts «event_created» in the create batch", async () => {
    await assertSucceeds(createBatch(dbAs(env, nevio), nevio).commit());
  });

  it("denies a wrong title, a missing event, details or a foreign actor", async () => {
    await assertFails(
      createBatch(dbAs(env, nevio), nevio, { activity: { targetTitle: "Anders" } }).commit(),
    );
    await assertFails(createBatch(dbAs(env, nevio), nevio, { activity: { details: {} } }).commit());
    await assertFails(
      createBatch(dbAs(env, nevio), nevio, { activity: { actorId: anna.uid } }).commit(),
    );
    await assertFails(
      setDoc(doc(dbAs(env, nevio), "households", HID, "activity", "a1"), {
        actorId: nevio.uid,
        type: "event_created",
        targetType: "event",
        targetId: "missing",
        targetTitle: "Znacht mit Freunden",
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("entries stay append-only", async () => {
    await createBatch(dbAs(env, nevio), nevio).commit();
    const db = dbAs(env, nevio);
    const [entry] = (await getDocs(collection(db, "households", HID, "activity"))).docs.filter(
      (d) => d.data().type === "event_created",
    );
    await assertFails(updateDoc(entry.ref, { targetTitle: "Anders" }));
    await assertFails(deleteDoc(entry.ref));
  });
});
