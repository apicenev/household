import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;

const nevio = { uid: "nevio", email: "nevio@example.ch" };
const anna = { uid: "anna", email: "anna@example.ch" };

function dbAs(user: { uid: string; email: string }) {
  return env.authenticatedContext(user.uid, { email: user.email }).firestore();
}

function newProfile(user: { uid: string; email: string }, overrides: Record<string, unknown> = {}) {
  return {
    displayName: "Nevio",
    email: user.email,
    initials: "NE",
    avatarColor: 3,
    householdId: null,
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-household",
    firestore: {
      // host/port come from FIRESTORE_EMULATOR_HOST, set by `firebase emulators:exec`
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users/anna"), {
      ...newProfile(anna, { displayName: "Anna", initials: "AN" }),
      createdAt: new Date(),
    });
  });
});

describe("users", () => {
  it("creates, reads and updates their own profile", async () => {
    const db = dbAs(nevio);
    await assertSucceeds(setDoc(doc(db, "users/nevio"), newProfile(nevio)));
    await assertSucceeds(getDoc(doc(db, "users/nevio")));
    await assertSucceeds(
      updateDoc(doc(db, "users/nevio"), {
        displayName: "Nevio A.",
        initials: "NA",
        avatarColor: 6,
      }),
    );
  });

  it("denies reading or writing another user's profile", async () => {
    const db = dbAs(nevio);
    await assertFails(getDoc(doc(db, "users/anna")));
    await assertFails(updateDoc(doc(db, "users/anna"), { displayName: "Hacked" }));
    await assertFails(setDoc(doc(db, "users/anna2"), newProfile(nevio)));
  });

  it("denies listing profiles", async () => {
    await assertFails(getDocs(collection(dbAs(nevio), "users")));
  });

  it("denies a create with the wrong email", async () => {
    await assertFails(
      setDoc(doc(dbAs(nevio), "users/nevio"), newProfile(nevio, { email: "anna@example.ch" })),
    );
  });

  it("denies a create with a household already set", async () => {
    await assertFails(
      setDoc(doc(dbAs(nevio), "users/nevio"), newProfile(nevio, { householdId: "h1" })),
    );
  });

  it("denies a create with extra or missing keys", async () => {
    await assertFails(
      setDoc(doc(dbAs(nevio), "users/nevio"), newProfile(nevio, { role: "admin" })),
    );
    const withoutInitials: Record<string, unknown> = newProfile(nevio);
    delete withoutInitials.initials;
    await assertFails(setDoc(doc(dbAs(nevio), "users/nevio"), withoutInitials));
  });

  it("denies invalid values", async () => {
    const db = dbAs(nevio);
    await assertFails(setDoc(doc(db, "users/nevio"), newProfile(nevio, { avatarColor: 9 })));
    await assertFails(setDoc(doc(db, "users/nevio"), newProfile(nevio, { avatarColor: 0 })));
    await assertFails(setDoc(doc(db, "users/nevio"), newProfile(nevio, { avatarColor: 2.5 })));
    await assertFails(setDoc(doc(db, "users/nevio"), newProfile(nevio, { displayName: "" })));
    await assertFails(
      setDoc(doc(db, "users/nevio"), newProfile(nevio, { displayName: "x".repeat(51) })),
    );
    await assertFails(setDoc(doc(db, "users/nevio"), newProfile(nevio, { initials: "ABC" })));
    await assertFails(
      setDoc(doc(db, "users/nevio"), newProfile(nevio, { createdAt: new Date(2020, 0, 1) })),
    );
  });

  it("denies updating householdId or email", async () => {
    const db = dbAs(anna);
    await assertFails(updateDoc(doc(db, "users/anna"), { householdId: "h1" }));
    await assertFails(updateDoc(doc(db, "users/anna"), { email: "other@example.ch" }));
    await assertFails(updateDoc(doc(db, "users/anna"), { avatarColor: 9 }));
  });

  it("denies deleting the profile", async () => {
    await assertFails(deleteDoc(doc(dbAs(anna), "users/anna")));
  });
});

describe("baseline", () => {
  it("denies unauthenticated access", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "users/anna")));
    await assertFails(setDoc(doc(db, "users/x"), { displayName: "X" }));
  });

  it("denies paths without rules, even for signed-in users", async () => {
    const db = dbAs(nevio);
    await assertFails(getDoc(doc(db, "households/h1")));
    await assertFails(setDoc(doc(db, "anything/else"), { value: 1 }));
  });
});
