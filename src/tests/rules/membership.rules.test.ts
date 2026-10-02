import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
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
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  CODE,
  HID,
  anna,
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

/** Profile + member doc (+ invite ownerName) as memberService.updateMyProfile writes them. */
function profileBatch(
  user: TestUser,
  profile: { displayName: string; initials: string; avatarColor: number },
  options: { member?: Record<string, unknown>; ownerName?: string } = {},
) {
  const db = dbAs(env, user);
  const batch = writeBatch(db);
  batch.update(doc(db, "users", user.uid), profile);
  batch.update(doc(db, "households", HID, "members", user.uid), {
    ...profile,
    ...options.member,
  });
  if (options.ownerName !== undefined) {
    batch.update(doc(db, "invites", CODE), { ownerName: options.ownerName });
  }
  return batch;
}

function activity(user: TestUser, overrides: Record<string, unknown> = {}) {
  return {
    actorId: user.uid,
    type: "member_joined",
    targetType: "member",
    targetId: user.uid,
    targetTitle: user.displayName,
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

describe("members", () => {
  it("lets members get and list the members", async () => {
    const db = dbAs(env, anna);
    await assertSucceeds(getDoc(doc(db, "households", HID, "members", nevio.uid)));
    await assertSucceeds(getDocs(collection(db, "households", HID, "members")));
  });

  it("denies non-members", async () => {
    const db = dbAs(env, lea);
    await assertFails(getDoc(doc(db, "households", HID, "members", nevio.uid)));
    await assertFails(getDocs(collection(db, "households", HID, "members")));
  });

  it("updates the own member doc together with the profile", async () => {
    await assertSucceeds(
      profileBatch(anna, { displayName: "Anna M.", initials: "AM", avatarColor: 2 }).commit(),
    );
  });

  it("denies a member doc that doesn't match the profile", async () => {
    await assertFails(
      profileBatch(
        anna,
        { displayName: "Anna M.", initials: "AM", avatarColor: 2 },
        { member: { displayName: "Chefin" } },
      ).commit(),
    );
    // Member doc alone, without the profile.
    await assertFails(
      updateDoc(doc(dbAs(env, anna), "households", HID, "members", anna.uid), {
        avatarColor: 5,
      }),
    );
  });

  it("denies changing someone else's member doc, the role or deleting", async () => {
    const db = dbAs(env, anna);
    await assertFails(
      updateDoc(doc(db, "households", HID, "members", nevio.uid), { displayName: "X" }),
    );
    await assertFails(
      updateDoc(doc(db, "households", HID, "members", anna.uid), { role: "owner" }),
    );
    await assertFails(deleteDoc(doc(db, "households", HID, "members", anna.uid)));
    await assertFails(deleteDoc(doc(dbAs(env, nevio), "households", HID, "members", anna.uid)));
  });
});

describe("invites", () => {
  it("lets any signed-in user get a code, including codes that don't exist", async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, lea), "invites", CODE)));
    await assertSucceeds(getDoc(doc(dbAs(env, lea), "invites", "XYZ-0000")));
  });

  it("denies listing codes and unauthenticated reads", async () => {
    await assertFails(getDocs(collection(dbAs(env, lea), "invites")));
    await assertFails(getDoc(doc(unauthenticatedDb(env), "invites", CODE)));
  });

  it("denies a create by a non-owner", async () => {
    const db = dbAs(env, anna);
    await assertFails(
      setDoc(doc(db, "invites", "ANN-1234"), {
        householdId: HID,
        householdName: "Musterstrasse 12",
        ownerName: "Anna",
        memberCount: 2,
        createdBy: anna.uid,
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("lets the owner change ownerName together with the profile", async () => {
    await assertSucceeds(
      profileBatch(
        nevio,
        { displayName: "Nevio A.", initials: "NA", avatarColor: 3 },
        { ownerName: "Nevio A." },
      ).commit(),
    );
  });

  it("denies ownerName changes by members or not matching the profile", async () => {
    await assertFails(
      profileBatch(
        anna,
        { displayName: "Anna M.", initials: "AM", avatarColor: 6 },
        { ownerName: "Anna M." },
      ).commit(),
    );
    await assertFails(
      profileBatch(
        nevio,
        { displayName: "Nevio A.", initials: "NA", avatarColor: 3 },
        { ownerName: "Jemand" },
      ).commit(),
    );
  });

  it("denies memberCount changes outside a join", async () => {
    await assertFails(updateDoc(doc(dbAs(env, nevio), "invites", CODE), { memberCount: 3 }));
    await assertFails(updateDoc(doc(dbAs(env, anna), "invites", CODE), { memberCount: 3 }));
  });

  it("denies updates by non-members and changes of householdId or createdAt", async () => {
    await assertFails(
      updateDoc(doc(dbAs(env, lea), "invites", CODE), { householdName: "Musterstrasse 12" }),
    );
    const db = dbAs(env, nevio);
    await assertFails(updateDoc(doc(db, "invites", CODE), { householdId: "other" }));
    await assertFails(updateDoc(doc(db, "invites", CODE), { createdAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, "invites", CODE), { createdBy: anna.uid }));
  });

  it("lets only the owner delete a code", async () => {
    await assertFails(deleteDoc(doc(dbAs(env, anna), "invites", CODE)));
    await assertFails(deleteDoc(doc(dbAs(env, lea), "invites", CODE)));
    await assertSucceeds(deleteDoc(doc(dbAs(env, nevio), "invites", CODE)));
  });
});

describe("users: householdId", () => {
  it("denies setting householdId without membership", async () => {
    await assertFails(updateDoc(doc(dbAs(env, lea), "users", lea.uid), { householdId: HID }));
  });

  it("denies moving to another household or clearing it", async () => {
    await seedHousehold(env, { hid: "other", owner: lea, code: "OTH-1111" });
    const db = dbAs(env, anna);
    await assertFails(updateDoc(doc(db, "users", anna.uid), { householdId: "other" }));
    await assertFails(updateDoc(doc(db, "users", anna.uid), { householdId: null }));
  });
});

describe("activity", () => {
  it("lets members create entries with their own actorId and list them", async () => {
    const db = dbAs(env, anna);
    await assertSucceeds(addDoc(collection(db, "households", HID, "activity"), activity(anna)));
    await assertSucceeds(
      addDoc(
        collection(db, "households", HID, "activity"),
        activity(anna, { details: { note: "x" } }),
      ),
    );
    await assertSucceeds(getDocs(collection(db, "households", HID, "activity")));
  });

  it("denies a foreign actorId, unknown types, extra keys and client timestamps", async () => {
    const col = collection(dbAs(env, anna), "households", HID, "activity");
    await assertFails(addDoc(col, activity(anna, { actorId: nevio.uid })));
    await assertFails(addDoc(col, activity(anna, { type: "task_hacked" })));
    await assertFails(addDoc(col, activity(anna, { extra: 1 })));
    await assertFails(addDoc(col, activity(anna, { createdAt: new Date() })));
    await assertFails(addDoc(col, activity(anna, { details: "text" })));
  });

  it("denies non-members, also «member_joined» outside a join", async () => {
    const db = dbAs(env, lea);
    await assertFails(getDocs(collection(db, "households", HID, "activity")));
    await assertFails(addDoc(collection(db, "households", HID, "activity"), activity(lea)));
  });

  it("denies a joiner's entry with a foreign targetId or another type", async () => {
    await env.clearFirestore();
    await seedProfiles(env, lea);
    await seedHousehold(env);
    const db = dbAs(env, lea);
    const join = (entry: Record<string, unknown>) => {
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
      batch.update(doc(db, "users", lea.uid), { householdId: HID });
      batch.set(doc(collection(db, "households", HID, "activity")), entry);
      return batch.commit();
    };
    await assertFails(join(activity(lea, { targetId: nevio.uid })));
    await assertFails(join(activity(lea, { targetType: "task" })));
    await assertSucceeds(join(activity(lea)));
  });

  it("denies updates and deletes", async () => {
    let id = "";
    const db = dbAs(env, anna);
    await assertSucceeds(
      addDoc(collection(db, "households", HID, "activity"), activity(anna)).then((ref) => {
        id = ref.id;
      }),
    );
    await assertFails(
      updateDoc(doc(db, "households", HID, "activity", id), { targetTitle: "Anders" }),
    );
    await assertFails(deleteDoc(doc(db, "households", HID, "activity", id)));
    await assertFails(deleteDoc(doc(dbAs(env, nevio), "households", HID, "activity", id)));
  });
});

describe("unauthenticated", () => {
  it("denies everything", async () => {
    const db = unauthenticatedDb(env);
    await assertFails(getDoc(doc(db, "households", HID)));
    await assertFails(getDocs(collection(db, "households", HID, "members")));
    await assertFails(getDocs(collection(db, "households", HID, "activity")));
    await assertFails(addDoc(collection(db, "households", HID, "activity"), activity(anna)));
    await assertFails(updateDoc(doc(db, "invites", CODE), { memberCount: 3 }));
  });
});
