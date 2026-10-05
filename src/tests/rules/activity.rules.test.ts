import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
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
} from "./helpers";

// The feed queries of /activity (Phase 8 B2, B3). The emulator ignores composite indexes, so
// the filtered query's index (firestore.indexes.json) is only exercised on the real project.

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
  await asAdmin(env, async (db) => {
    await setDoc(doc(db, "households", HID, "activity", "a1"), {
      actorId: "anna",
      type: "task_completed",
      targetType: "task",
      targetId: "t1",
      targetTitle: "Bad putzen",
      createdAt: new Date("2026-09-30T16:40:00Z"),
    });
  });
});

const activity = (db: Firestore) => collection(db, "households", HID, "activity");

const feed = (db: Firestore) => query(activity(db), orderBy("createdAt", "desc"), limit(50));

const filtered = (db: Firestore) =>
  query(activity(db), where("targetType", "==", "item"), orderBy("createdAt", "desc"), limit(50));

describe("activity feed (Phase 8)", () => {
  it("members list the feed, unfiltered and by target type", async () => {
    for (const user of [nevio, anna]) {
      await assertSucceeds(getDocs(feed(dbAs(env, user))));
      await assertSucceeds(getDocs(filtered(dbAs(env, user))));
    }
  });

  it("denies the feed to non-members and signed-out users", async () => {
    await assertFails(getDocs(feed(dbAs(env, lea))));
    await assertFails(getDocs(filtered(dbAs(env, lea))));
    await assertFails(getDocs(feed(unauthenticatedDb(env))));
  });

  it("keeps entries append-only (ACT-06)", async () => {
    const entry = doc(dbAs(env, anna), "households", HID, "activity", "a1");
    await assertFails(updateDoc(entry, { targetTitle: "Anders" }));
    await assertFails(deleteDoc(entry));
  });
});
