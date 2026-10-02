import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TIME_ZONES } from "../../domain/timeZones";
import {
  CODE,
  DAY_MS,
  HID,
  anna,
  asAdmin,
  createBatch,
  createTestEnvironment,
  dbAs,
  joinBatch,
  lea,
  newCodeBatch,
  nevio,
  seedHousehold,
  seedProfiles,
  unauthenticatedDb,
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
  await seedProfiles(env, nevio, anna, lea);
});

describe("households: create", () => {
  it("creates a household with owner member, invite and profile in one batch", async () => {
    const db = dbAs(env, nevio);
    await assertSucceeds(createBatch(db, nevio).commit());
    await assertSucceeds(getDoc(doc(db, "households", HID)));
    await assertSucceeds(getDoc(doc(db, "households", HID, "members", nevio.uid)));
  });

  it("denies someone else as owner or in memberIds", async () => {
    const db = dbAs(env, nevio);
    await assertFails(createBatch(db, nevio, { household: { ownerId: anna.uid } }).commit());
    await assertFails(
      createBatch(db, nevio, { household: { memberIds: [nevio.uid, anna.uid] } }).commit(),
    );
  });

  it("denies a create while already in a household", async () => {
    await seedHousehold(env, { hid: "other", code: "OTH-1111" });
    // Nevio's profile now has householdId "other".
    await assertFails(createBatch(dbAs(env, nevio), nevio).commit());
  });

  it("denies incomplete batches", async () => {
    const db = dbAs(env, nevio);
    await assertFails(createBatch(db, nevio, { member: false }).commit());
    await assertFails(createBatch(db, nevio, { user: false }).commit());
    await assertFails(createBatch(db, nevio, { invite: false }).commit());
  });

  it("denies a member doc that isn't the owner's or doesn't match the profile", async () => {
    const db = dbAs(env, nevio);
    await assertFails(createBatch(db, nevio, { member: { role: "member" } }).commit());
    await assertFails(createBatch(db, nevio, { member: { displayName: "Boss" } }).commit());
    await assertFails(createBatch(db, nevio, { member: { joinedWithCode: CODE } }).commit());
  });

  it("denies client timestamps", async () => {
    const db = dbAs(env, nevio);
    const past = new Date(Date.now() - 8 * DAY_MS);
    await assertFails(createBatch(db, nevio, { household: { inviteCreatedAt: past } }).commit());
    await assertFails(createBatch(db, nevio, { household: { createdAt: past } }).commit());
    await assertFails(createBatch(db, nevio, { invite: { createdAt: past } }).commit());
  });

  it("validates name, week start, time zone, code and keys", async () => {
    const db = dbAs(env, nevio);
    const invalid = [
      { name: "" },
      { name: "x".repeat(51) },
      { weekStartsOn: 2 },
      { weekStartsOn: "1" },
      { timeZone: "Europe/Moscow" },
      { extra: true },
    ];
    for (const household of invalid) {
      await assertFails(createBatch(db, nevio, { household }).commit());
    }
    await assertFails(createBatch(db, nevio, { code: "MIO-1234" }).commit());
    await assertFails(createBatch(db, nevio, { code: "mst-4821" }).commit());
  });

  it("accepts every time zone of TIME_ZONES (rules and domain in sync)", async () => {
    for (const [i, zone] of TIME_ZONES.entries()) {
      const user = { ...nevio, uid: `owner${i}`, email: `owner${i}@example.ch` };
      await seedProfiles(env, user);
      const db = dbAs(env, user);
      const hid = `tz${i}`;
      const code = `TZA-000${i}`;
      await assertSucceeds(
        createBatch(db, user, { hid, code, household: { timeZone: zone.id } }).commit(),
      );
    }
  });

  it("denies an invite preview that doesn't match the household or profile", async () => {
    const db = dbAs(env, nevio);
    await assertFails(createBatch(db, nevio, { invite: { ownerName: "Someone" } }).commit());
    await assertFails(createBatch(db, nevio, { invite: { householdName: "Other" } }).commit());
    await assertFails(createBatch(db, nevio, { invite: { memberCount: 5 } }).commit());
    await assertFails(createBatch(db, nevio, { invite: { householdId: "other" } }).commit());
  });

  it("denies taking over another household's existing code", async () => {
    await seedHousehold(env, { hid: "other", owner: anna, code: CODE });
    await assertFails(createBatch(dbAs(env, nevio), nevio, { code: CODE }).commit());
  });
});

describe("households: read", () => {
  beforeEach(async () => {
    await seedHousehold(env, { members: [anna] });
  });

  it("lets members get the household", async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, nevio), "households", HID)));
    await assertSucceeds(getDoc(doc(dbAs(env, anna), "households", HID)));
  });

  it("denies non-members, lists and unauthenticated users", async () => {
    await assertFails(getDoc(doc(dbAs(env, lea), "households", HID)));
    await assertFails(getDocs(collection(dbAs(env, nevio), "households")));
    await assertFails(getDoc(doc(unauthenticatedDb(env), "households", HID)));
  });
});

describe("households: settings, delete", () => {
  beforeEach(async () => {
    await seedHousehold(env, { members: [anna] });
  });

  it("lets the owner change the settings", async () => {
    const db = dbAs(env, nevio);
    const batch = writeBatch(db);
    batch.update(doc(db, "households", HID), {
      name: "WG Linde",
      weekStartsOn: 0,
      timeZone: "Europe/Berlin",
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, "invites", CODE), { householdName: "WG Linde" });
    await assertSucceeds(batch.commit());
  });

  it("denies settings changes by members and invalid values", async () => {
    await assertFails(
      updateDoc(doc(dbAs(env, anna), "households", HID), {
        name: "Annas WG",
        updatedAt: serverTimestamp(),
      }),
    );
    const db = dbAs(env, nevio);
    await assertFails(
      updateDoc(doc(db, "households", HID), { name: "", updatedAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(doc(db, "households", HID), {
        timeZone: "Mars/Olympus",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(db, "households", HID), { ownerId: anna.uid, updatedAt: serverTimestamp() }),
    );
    await assertFails(updateDoc(doc(db, "households", HID), { name: "Ohne Zeitstempel" }));
  });

  it("denies an invite rename that doesn't match the household", async () => {
    await assertFails(
      updateDoc(doc(dbAs(env, nevio), "invites", CODE), { householdName: "Falsch" }),
    );
  });

  it("lets only the owner delete the household", async () => {
    await assertFails(deleteDoc(doc(dbAs(env, anna), "households", HID)));
    await assertFails(deleteDoc(doc(dbAs(env, lea), "households", HID)));
    await assertSucceeds(deleteDoc(doc(dbAs(env, nevio), "households", HID)));
  });
});

describe("households: join", () => {
  beforeEach(async () => {
    await seedHousehold(env);
  });

  it("joins with the current code", async () => {
    const db = dbAs(env, anna);
    await assertSucceeds(joinBatch(db, anna).commit());
    await assertSucceeds(getDoc(doc(db, "households", HID)));
    let memberCount: unknown;
    await asAdmin(env, async (admin) => {
      memberCount = (await getDoc(doc(admin, "invites", CODE))).data()?.memberCount;
    });
    expect(memberCount).toBe(2);
  });

  it("allows concurrent joins (arrayUnion)", async () => {
    await assertSucceeds(joinBatch(dbAs(env, anna), anna).commit());
    await assertSucceeds(joinBatch(dbAs(env, lea), lea).commit());
  });

  it("denies a member joining again", async () => {
    await assertSucceeds(joinBatch(dbAs(env, anna), anna).commit());
    await asAdmin(env, (db) => updateDoc(doc(db, "users", anna.uid), { householdId: null }));
    await assertFails(joinBatch(dbAs(env, anna), anna, { activity: false }).commit());
  });

  it("denies an expired code", async () => {
    await env.clearFirestore();
    await seedProfiles(env, anna);
    await seedHousehold(env, { inviteCreatedAt: new Date(Date.now() - 7 * DAY_MS - 60_000) });
    await assertFails(joinBatch(dbAs(env, anna), anna).commit());
  });

  it("accepts a code shortly before it expires", async () => {
    await env.clearFirestore();
    await seedProfiles(env, anna);
    await seedHousehold(env, { inviteCreatedAt: new Date(Date.now() - 7 * DAY_MS + 60_000) });
    await assertSucceeds(joinBatch(dbAs(env, anna), anna).commit());
  });

  it("denies a wrong code", async () => {
    await asAdmin(env, (db) =>
      setDoc(doc(db, "invites", "XYZ-0000"), {
        householdId: HID,
        householdName: "Musterstrasse 12",
        ownerName: "Nevio",
        memberCount: 1,
        createdBy: nevio.uid,
        createdAt: new Date(),
      }),
    );
    await assertFails(joinBatch(dbAs(env, anna), anna, { code: "XYZ-0000" }).commit());
    await assertFails(
      joinBatch(dbAs(env, anna), anna, { member: { joinedWithCode: "XYZ-0000" } }).commit(),
    );
  });

  it("denies the old code after «Neuer Code»", async () => {
    await assertSucceeds(newCodeBatch(dbAs(env, nevio), nevio, "NEW-1234").commit());
    // The old invite is gone (the service reports «gibt es nicht»); even without updating
    // it, the household rejects the old code.
    await assertFails(joinBatch(dbAs(env, anna), anna, { invite: false }).commit());
    await assertSucceeds(joinBatch(dbAs(env, anna), anna, { code: "NEW-1234" }).commit());
  });

  it("denies adding someone else or removing a member", async () => {
    const db = dbAs(env, anna);
    await assertFails(
      joinBatch(db, anna, { household: { memberIds: [nevio.uid, anna.uid, lea.uid] } }).commit(),
    );
    await assertFails(joinBatch(db, anna, { household: { memberIds: [anna.uid] } }).commit());
    // Anna writes Lea's member doc and profile.
    const batch = writeBatch(db);
    batch.update(doc(db, "households", HID), {
      memberIds: [nevio.uid, lea.uid],
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, "households", HID, "members", lea.uid), {
      displayName: lea.displayName,
      initials: lea.initials,
      avatarColor: lea.avatarColor,
      role: "member",
      joinedAt: serverTimestamp(),
      joinedWithCode: CODE,
    });
    await assertFails(batch.commit());
  });

  it("denies changing other fields while joining", async () => {
    await assertFails(
      joinBatch(dbAs(env, anna), anna, { household: { name: "Gekapert" } }).commit(),
    );
  });

  it("denies joining while already in another household", async () => {
    await seedHousehold(env, { hid: "other", owner: lea, code: "OTH-1111" });
    await assertFails(joinBatch(dbAs(env, lea), lea).commit());
  });

  it("denies incomplete join batches", async () => {
    const db = dbAs(env, anna);
    await assertFails(joinBatch(db, anna, { member: false }).commit());
    await assertFails(joinBatch(db, anna, { user: false }).commit());
  });

  it("denies a joiner member doc with the wrong role or profile", async () => {
    const db = dbAs(env, anna);
    await assertFails(joinBatch(db, anna, { member: { role: "owner" } }).commit());
    await assertFails(joinBatch(db, anna, { member: { displayName: "Chefin" } }).commit());
  });

  it("joins with a drifted memberCount", async () => {
    await asAdmin(env, (db) => updateDoc(doc(db, "invites", CODE), { memberCount: 7 }));
    await assertSucceeds(joinBatch(dbAs(env, anna), anna).commit());
  });

  it("denies a memberCount other than +1", async () => {
    await assertFails(joinBatch(dbAs(env, anna), anna, { invite: { memberCount: 3 } }).commit());
  });
});

describe("households: new code", () => {
  beforeEach(async () => {
    await seedHousehold(env, { members: [anna] });
  });

  it("lets the owner replace the code", async () => {
    await assertSucceeds(
      newCodeBatch(dbAs(env, nevio), nevio, "NEW-1234", { memberCount: 2 }).commit(),
    );
  });

  it("denies a new code without deleting the old one", async () => {
    await assertFails(
      newCodeBatch(dbAs(env, nevio), nevio, "NEW-1234", {
        memberCount: 2,
        deleteOld: false,
      }).commit(),
    );
  });

  it("denies a new code by a member", async () => {
    await assertFails(newCodeBatch(dbAs(env, anna), anna, "NEW-1234", { memberCount: 2 }).commit());
  });

  it("denies taking over another household's code", async () => {
    await seedHousehold(env, { hid: "other", owner: lea, code: "OTH-1111" });
    await assertFails(
      newCodeBatch(dbAs(env, nevio), nevio, "OTH-1111", { memberCount: 2 }).commit(),
    );
  });
});
