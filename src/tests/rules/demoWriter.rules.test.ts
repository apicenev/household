import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_HOUSEHOLD_ID,
  deleteDemoContent,
  demoState,
  writeDemo,
} from "../../../scripts/demo/demoWriter";

// Phase 9 §9.12: the demo setup's writer against the emulator (Admin SDK, rules bypassed, as
// in the real project). The Auth lookup by email is covered by the manual smoke run.

const users = [
  { uid: "demo1", email: "demo1@example.com" },
  { uid: "demo2", email: "demo2@example.com" },
] as const;

let app: App;
let db: Firestore;

beforeAll(() => {
  // firebase-admin probes the cloud metadata server for credentials first (a harmless
  // warning); the emulator doesn't need any.
  app = initializeApp({ projectId: "demo-household" }, "demo-writer");
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

async function clear() {
  for (const collection of await db.listCollections()) await db.recursiveDelete(collection);
}

async function profiles(householdId: string | null = null) {
  for (const user of users) {
    await db.doc(`users/${user.uid}`).set({
      displayName: user.email,
      email: user.email,
      initials: "DE",
      avatarColor: 1,
      householdId,
      createdAt: new Date(),
    });
  }
}

const count = async (path: string) => (await db.collection(path).get()).size;

beforeEach(async () => {
  await clear();
  await profiles();
});

describe("demo writer (C6)", () => {
  it("sets up a fresh demo household, then finds it again", async () => {
    expect(await demoState(db, users)).toEqual({ kind: "fresh" });
    await writeDemo(db, { users: [users[0], users[1]] });
    const household = (await db.doc(`households/${DEMO_HOUSEHOLD_ID}`).get()).data();
    expect(household).toMatchObject({ name: "Demo-Haushalt", demo: true });
    expect((await db.doc("users/demo1").get()).data()).toMatchObject({
      displayName: "Demo User 1",
      householdId: DEMO_HOUSEHOLD_ID,
    });
    expect(await count(`households/${DEMO_HOUSEHOLD_ID}/tasks`)).toBe(22);
    expect(await demoState(db, users)).toMatchObject({
      kind: "existing",
      householdId: DEMO_HOUSEHOLD_ID,
      inviteCode: household?.inviteCode,
    });
  });

  it("resets: visitors' changes go, names come back, twice in a row", async () => {
    await writeDemo(db, { users: [users[0], users[1]] });
    await db.doc(`households/${DEMO_HOUSEHOLD_ID}`).update({ timeZone: "Asia/Tokyo" });
    await db.doc("users/demo2").update({ displayName: "Troll" });
    await db.doc(`households/${DEMO_HOUSEHOLD_ID}/tasks/visitor`).set({ title: "Hallo" });

    for (let run = 0; run < 2; run++) {
      const state = await demoState(db, users);
      if (state.kind !== "existing") throw new Error("expected the demo household");
      await deleteDemoContent(db, state.householdId, state.inviteCode, false);
      await writeDemo(db, { users: [users[0], users[1]], householdId: state.householdId });
    }

    expect((await db.doc(`households/${DEMO_HOUSEHOLD_ID}`).get()).data()?.timeZone).toBe(
      "Europe/Zurich",
    );
    expect((await db.doc("users/demo2").get()).data()?.displayName).toBe("Demo User 2");
    expect((await db.doc(`households/${DEMO_HOUSEHOLD_ID}/tasks/visitor`).get()).exists).toBe(
      false,
    );
    expect(await count(`households/${DEMO_HOUSEHOLD_ID}/tasks`)).toBe(22);
    expect(await count("invites")).toBe(1);
  });

  it("writes and deletes nothing on a dry run", async () => {
    const docs = await writeDemo(db, { users: [users[0], users[1]], dryRun: true });
    expect(docs.length).toBeGreaterThan(100);
    expect((await db.doc(`households/${DEMO_HOUSEHOLD_ID}`).get()).exists).toBe(false);
    await writeDemo(db, { users: [users[0], users[1]] });
    const state = await demoState(db, users);
    if (state.kind !== "existing") throw new Error("expected the demo household");
    const planned = await deleteDemoContent(db, state.householdId, state.inviteCode, true);
    expect(planned).toBeGreaterThan(100);
    expect(await count(`households/${DEMO_HOUSEHOLD_ID}/tasks`)).toBe(22);
  });

  it("refuses an account in a real household, or in different households", async () => {
    await db.doc("households/real").set({ name: "Echt", memberIds: ["demo1", "nevio"] });
    await db.doc("users/demo1").update({ householdId: "real" });
    expect(await demoState(db, users)).toMatchObject({ kind: "refused" });
    await db.doc("users/demo2").update({ householdId: "other" });
    expect(await demoState(db, users)).toMatchObject({ kind: "refused" });
  });

  it("refuses a household without `demo`, or with someone else in it", async () => {
    await profiles("h");
    await db.doc("households/h").set({ name: "WG", memberIds: ["demo1", "demo2"] });
    expect(await demoState(db, users)).toMatchObject({ kind: "refused" });
    await db.doc("households/h").set({ demo: true, memberIds: ["demo1", "demo2", "lea"] });
    expect(await demoState(db, users)).toMatchObject({ kind: "refused" });
  });

  it("refuses when the fixed id is taken by a real household", async () => {
    await db.doc(`households/${DEMO_HOUSEHOLD_ID}`).set({ name: "Zufall", memberIds: ["x"] });
    expect(await demoState(db, users)).toMatchObject({ kind: "refused" });
  });
});
