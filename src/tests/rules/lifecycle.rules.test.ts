import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  arrayRemove,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  CODE,
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

// Phase 9 §9.3: leave, remove, hand over, delete, self-heal and the demo guard.

const mia: TestUser = {
  uid: "mia",
  email: "mia@example.ch",
  displayName: "Mia",
  initials: "MI",
  avatarColor: 4,
};

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
  await seedHousehold(env, { members: [anna, mia] });
});

const householdRef = (db: Firestore, hid = HID) => doc(db, "households", hid);
const memberRef = (db: Firestore, uid: string, hid = HID) =>
  doc(db, "households", hid, "members", uid);

async function setHousehold(fields: Record<string, unknown>, hid = HID) {
  await asAdmin(env, (db) => updateDoc(householdRef(db, hid), fields));
}

async function seedTask(id: string, fields: Record<string, unknown>) {
  await asAdmin(env, async (db) => {
    const now = new Date();
    await setDoc(doc(db, "households", HID, "tasks", id), {
      title: "Bad putzen",
      assigneeId: null,
      dueDate: "2026-10-03",
      priority: "low",
      status: "open",
      createdBy: nevio.uid,
      createdAt: now,
      updatedAt: now,
      ...fields,
    });
  });
}

function memberActivity(user: TestUser, type: string, target: TestUser) {
  return {
    actorId: user.uid,
    type,
    targetType: "member",
    targetId: target.uid,
    targetTitle: target.displayName,
    createdAt: serverTimestamp(),
  };
}

interface LeaveOptions {
  household?: Record<string, unknown> | false;
  member?: false;
  user?: false;
  invite?: Record<string, unknown> | false;
  activity?: Record<string, unknown> | false;
}

/** The leave batch as householdService.leaveHousehold writes it (B2). */
function leaveBatch(user: TestUser, options: LeaveOptions = {}) {
  const db = dbAs(env, user);
  const batch = writeBatch(db);
  if (options.household !== false) {
    batch.update(householdRef(db), {
      memberIds: arrayRemove(user.uid),
      updatedAt: serverTimestamp(),
      ...options.household,
    });
  }
  if (options.member !== false) batch.delete(memberRef(db, user.uid));
  if (options.user !== false) batch.update(doc(db, "users", user.uid), { householdId: null });
  if (options.invite !== false) {
    batch.update(doc(db, "invites", CODE), { memberCount: increment(-1), ...options.invite });
  }
  if (options.activity !== false) {
    batch.set(doc(collection(db, "households", HID, "activity")), {
      ...memberActivity(user, "member_left", user),
      ...options.activity,
    });
  }
  return { db, batch };
}

/** The remove batch as householdService.removeMember writes it (B4). */
function removeBatch(owner: TestUser, target: TestUser, options: LeaveOptions = {}) {
  const db = dbAs(env, owner);
  const batch = writeBatch(db);
  if (options.household !== false) {
    batch.update(householdRef(db), {
      memberIds: arrayRemove(target.uid),
      updatedAt: serverTimestamp(),
      ...options.household,
    });
  }
  if (options.member !== false) batch.delete(memberRef(db, target.uid));
  if (options.invite !== false) {
    batch.update(doc(db, "invites", CODE), { memberCount: increment(-1), ...options.invite });
  }
  if (options.activity !== false) {
    batch.set(doc(collection(db, "households", HID, "activity")), {
      ...memberActivity(owner, "member_removed", target),
      ...options.activity,
    });
  }
  return { db, batch };
}

interface HandOverOptions {
  ownerRole?: false;
  targetRole?: false;
  ownerName?: string | false;
}

/** The hand-over batch as householdService.handOverHousehold writes it (B5). */
function handOverBatch(owner: TestUser, target: TestUser, options: HandOverOptions = {}) {
  const db = dbAs(env, owner);
  const batch = writeBatch(db);
  batch.update(householdRef(db), { ownerId: target.uid, updatedAt: serverTimestamp() });
  if (options.ownerRole !== false) batch.update(memberRef(db, owner.uid), { role: "member" });
  if (options.targetRole !== false) batch.update(memberRef(db, target.uid), { role: "owner" });
  if (options.ownerName !== false) {
    batch.update(doc(db, "invites", CODE), {
      ownerName: options.ownerName ?? target.displayName,
    });
  }
  return batch;
}

/** Step 1 of a delete (B7). */
function startDelete(db: Firestore, owner: TestUser, fields: Record<string, unknown> = {}) {
  return updateDoc(householdRef(db), {
    deleting: true,
    memberIds: [owner.uid],
    updatedAt: serverTimestamp(),
    ...fields,
  });
}

/** Step 3 of a delete (B7): invite, own member doc, household, own householdId. */
function finalDeleteBatch(db: Firestore, owner: TestUser) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "invites", CODE));
  batch.delete(memberRef(db, owner.uid));
  batch.delete(householdRef(db));
  batch.update(doc(db, "users", owner.uid), { householdId: null });
  return batch;
}

describe("leave (B1, B2)", () => {
  it("lets a member leave with the complete batch", async () => {
    const { batch } = leaveBatch(anna);
    await assertSucceeds(batch.commit());
  });

  it("denies an incomplete leave batch", async () => {
    for (const omit of ["member", "user"] as const) {
      await seedHousehold(env, { members: [anna, mia] });
      const { batch } = leaveBatch(anna, { [omit]: false });
      await assertFails(batch.commit());
    }
  });

  it("denies the owner leaving (hand over first, HH-12)", async () => {
    const { batch } = leaveBatch(nevio);
    await assertFails(batch.commit());
  });

  it("denies a member taking someone else out", async () => {
    const db = dbAs(env, anna);
    const batch = writeBatch(db);
    batch.update(householdRef(db), {
      memberIds: arrayRemove(mia.uid),
      updatedAt: serverTimestamp(),
    });
    batch.delete(memberRef(db, mia.uid));
    await assertFails(batch.commit());
  });

  it("takes the leaver out of rotationOrder, and only them", async () => {
    await setHousehold({ rotationOrder: [nevio.uid, anna.uid, mia.uid] });
    await assertFails(leaveBatch(anna).batch.commit());
    await assertFails(
      leaveBatch(anna, {
        household: { rotationOrder: [nevio.uid] },
      }).batch.commit(),
    );
    await assertSucceeds(
      leaveBatch(anna, {
        household: { rotationOrder: arrayRemove(anna.uid) },
      }).batch.commit(),
    );
  });

  it("lets the leave batch clean up tasks: unassign, rotation with the index kept (B3)", async () => {
    await seedTask("t1", { assigneeId: anna.uid });
    await seedTask("t2", {
      assigneeId: anna.uid,
      recurrence: { freq: "weekly", interval: 1, byWeekday: [6] },
      seriesId: "s2",
      seriesIndex: 1,
      rotation: { memberIds: [nevio.uid, anna.uid, mia.uid], index: 1 },
    });
    const { db, batch } = leaveBatch(anna);
    batch.update(doc(db, "households", HID, "tasks", "t1"), {
      assigneeId: null,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, "households", HID, "tasks", "t2"), {
      assigneeId: mia.uid,
      rotation: { memberIds: [nevio.uid, mia.uid], index: 1 },
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
  });

  it("records member_left only about oneself and only when leaving", async () => {
    const { batch } = leaveBatch(anna, { activity: { targetId: mia.uid } });
    await assertFails(batch.commit());
    const db = dbAs(env, anna);
    await assertFails(
      setDoc(
        doc(db, "households", HID, "activity", "a1"),
        memberActivity(anna, "member_left", anna),
      ),
    );
  });

  it("allows the invite −1 only in the batch that makes memberIds shorter (B9)", async () => {
    const db = dbAs(env, anna);
    await assertFails(updateDoc(doc(db, "invites", CODE), { memberCount: increment(-1) }));
    await assertFails(leaveBatch(anna, { invite: { memberCount: increment(-2) } }).batch.commit());
    await assertSucceeds(leaveBatch(anna).batch.commit());
  });
});

describe("remove a member (B4)", () => {
  it("lets the owner remove a member with the complete batch", async () => {
    await assertSucceeds(removeBatch(nevio, anna).batch.commit());
  });

  it("denies a member removing someone, and the owner removing themself", async () => {
    await assertFails(removeBatch(anna, mia).batch.commit());
    await assertFails(removeBatch(nevio, nevio).batch.commit());
  });

  it("denies a removal that leaves the member doc behind", async () => {
    await assertFails(removeBatch(nevio, anna, { member: false }).batch.commit());
  });

  it("denies removing two members at once", async () => {
    const db = dbAs(env, nevio);
    const batch = writeBatch(db);
    batch.update(householdRef(db), { memberIds: [nevio.uid], updatedAt: serverTimestamp() });
    batch.delete(memberRef(db, anna.uid));
    batch.delete(memberRef(db, mia.uid));
    await assertFails(batch.commit());
  });

  it("denies deleting a member doc of someone who stays", async () => {
    await assertFails(deleteDoc(memberRef(dbAs(env, nevio), anna.uid)));
    await assertFails(deleteDoc(memberRef(dbAs(env, anna), anna.uid)));
  });

  it("records member_removed only by the owner, about the removed member", async () => {
    await assertFails(removeBatch(nevio, anna, { activity: { targetId: mia.uid } }).batch.commit());
  });
});

describe("hand over (B5)", () => {
  it("lets the owner hand over with the complete batch", async () => {
    await assertSucceeds(handOverBatch(nevio, anna).commit());
    // The new owner can change settings, the old one can't.
    await assertSucceeds(
      updateDoc(householdRef(dbAs(env, anna)), { name: "Neu", updatedAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(householdRef(dbAs(env, nevio)), { name: "Alt", updatedAt: serverTimestamp() }),
    );
  });

  it("denies a hand-over without both role changes", async () => {
    await assertFails(handOverBatch(nevio, anna, { ownerRole: false }).commit());
    await seedHousehold(env, { members: [anna, mia] });
    await assertFails(handOverBatch(nevio, anna, { targetRole: false }).commit());
  });

  // Writing the old owner's name again changes nothing, so it isn't checked; the preview
  // then just keeps the old name.
  it("denies a third member's name on the invite", async () => {
    await assertFails(handOverBatch(nevio, anna, { ownerName: mia.displayName }).commit());
  });

  it("denies a hand-over by a member or to an outsider", async () => {
    await assertFails(handOverBatch(anna, mia).commit());
    await assertFails(handOverBatch(nevio, lea).commit());
  });

  it("denies changing a role outside a hand-over", async () => {
    await assertFails(updateDoc(memberRef(dbAs(env, anna), anna.uid), { role: "owner" }));
    await assertFails(updateDoc(memberRef(dbAs(env, nevio), anna.uid), { role: "owner" }));
  });
});

describe("delete (B7)", () => {
  async function seedContent() {
    await seedTask("t1", {});
    await asAdmin(env, async (db) => {
      await setDoc(doc(db, "households", HID, "itemStats", "milch"), {
        name: "Milch",
        category: "groceries",
        count: 3,
        lastPurchasedAt: new Date(),
      });
      await setDoc(doc(db, "households", HID, "activity", "a1"), {
        ...memberActivity(anna, "member_joined", anna),
        createdAt: new Date(),
      });
    });
  }

  it("runs start → chunks → final batch", async () => {
    await seedContent();
    const db = dbAs(env, nevio);
    await assertSucceeds(startDelete(db, nevio));
    await assertSucceeds(deleteDoc(doc(db, "households", HID, "tasks", "t1")));
    await assertSucceeds(deleteDoc(doc(db, "households", HID, "itemStats", "milch")));
    await assertSucceeds(deleteDoc(doc(db, "households", HID, "activity", "a1")));
    await assertSucceeds(deleteDoc(memberRef(db, anna.uid)));
    await assertSucceeds(deleteDoc(memberRef(db, mia.uid)));
    await assertSucceeds(finalDeleteBatch(db, nevio).commit());
  });

  it("denies deleting stats, activity or the household without starting", async () => {
    await seedContent();
    const db = dbAs(env, nevio);
    await assertFails(deleteDoc(doc(db, "households", HID, "itemStats", "milch")));
    await assertFails(deleteDoc(doc(db, "households", HID, "activity", "a1")));
    await assertFails(deleteDoc(householdRef(db)));
  });

  it("denies a start that keeps other members or the rotation order", async () => {
    const db = dbAs(env, nevio);
    await assertFails(startDelete(db, nevio, { memberIds: [nevio.uid, anna.uid] }));
    await setHousehold({ rotationOrder: [nevio.uid, anna.uid] });
    await assertFails(startDelete(db, nevio));
    await assertSucceeds(startDelete(db, nevio, { rotationOrder: deleteField() }));
  });

  it("denies a start by a member", async () => {
    await assertFails(startDelete(dbAs(env, anna), anna));
  });

  it("shuts other members out once the delete started", async () => {
    await seedContent();
    await assertSucceeds(startDelete(dbAs(env, nevio), nevio));
    const db = dbAs(env, anna);
    await assertFails(getDoc(householdRef(db)));
    await assertFails(getDocs(collection(db, "households", HID, "tasks")));
    await assertFails(
      updateDoc(doc(db, "households", HID, "tasks", "t1"), {
        title: "Noch da?",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("denies joining a household that is being deleted", async () => {
    await seedProfiles(env, lea);
    await assertSucceeds(startDelete(dbAs(env, nevio), nevio));
    const db = dbAs(env, lea);
    const batch = writeBatch(db);
    batch.update(householdRef(db), {
      memberIds: [nevio.uid, lea.uid],
      updatedAt: serverTimestamp(),
    });
    batch.set(memberRef(db, lea.uid), {
      displayName: lea.displayName,
      initials: lea.initials,
      avatarColor: lea.avatarColor,
      role: "member",
      joinedAt: serverTimestamp(),
      joinedWithCode: CODE,
    });
    batch.update(doc(db, "users", lea.uid), { householdId: HID });
    await assertFails(batch.commit());
  });
});

describe("self-heal (B6)", () => {
  it("lets a removed member clear their householdId, not a current one", async () => {
    const db = dbAs(env, anna);
    await assertFails(updateDoc(doc(db, "users", anna.uid), { householdId: null }));
    await assertSucceeds(removeBatch(nevio, anna).batch.commit());
    await assertSucceeds(updateDoc(doc(db, "users", anna.uid), { householdId: null }));
  });

  it("lets members of a deleting or deleted household clear it", async () => {
    await assertSucceeds(startDelete(dbAs(env, nevio), nevio));
    await assertSucceeds(updateDoc(doc(dbAs(env, anna), "users", anna.uid), { householdId: null }));
    await asAdmin(env, (db) => deleteDoc(householdRef(db)));
    await assertSucceeds(updateDoc(doc(dbAs(env, mia), "users", mia.uid), { householdId: null }));
  });

  it("allows only null, never a switch to another household", async () => {
    await assertSucceeds(removeBatch(nevio, anna).batch.commit());
    await assertFails(updateDoc(doc(dbAs(env, anna), "users", anna.uid), { householdId: "h2" }));
  });
});

describe("demo guard (C4, C5)", () => {
  beforeEach(async () => {
    await setHousehold({ demo: true });
  });

  it("denies leave, remove, hand-over, start delete and delete", async () => {
    await assertFails(leaveBatch(anna).batch.commit());
    await assertFails(removeBatch(nevio, anna).batch.commit());
    await assertFails(handOverBatch(nevio, anna).commit());
    await assertFails(startDelete(dbAs(env, nevio), nevio));
    await setHousehold({ deleting: true });
    await assertFails(deleteDoc(householdRef(dbAs(env, nevio))));
  });

  it("denies renaming the household, allows the other settings", async () => {
    const db = dbAs(env, nevio);
    await assertFails(updateDoc(householdRef(db), { name: "Neu", updatedAt: serverTimestamp() }));
    await assertSucceeds(
      updateDoc(householdRef(db), { weekStartsOn: 0, updatedAt: serverTimestamp() }),
    );
  });

  it("denies a demo user's name change, allows the avatar colour", async () => {
    const db = dbAs(env, anna);
    const rename = writeBatch(db);
    rename.update(doc(db, "users", anna.uid), { displayName: "Troll", initials: "TR" });
    rename.update(memberRef(db, anna.uid), { displayName: "Troll", initials: "TR" });
    await assertFails(rename.commit());
    const colour = writeBatch(db);
    colour.update(doc(db, "users", anna.uid), { avatarColor: 2 });
    colour.update(memberRef(db, anna.uid), { avatarColor: 2 });
    await assertSucceeds(colour.commit());
  });

  it("never lets a client set or clear `demo`", async () => {
    const db = dbAs(env, nevio);
    await assertFails(updateDoc(householdRef(db), { demo: false, updatedAt: serverTimestamp() }));
    await assertFails(
      updateDoc(householdRef(db), { demo: deleteField(), updatedAt: serverTimestamp() }),
    );
  });

  it("keeps demo users out of other households (C7)", async () => {
    await seedHousehold(env, { hid: "real", owner: lea, code: "REA-1234", name: "Echt" });
    const db = dbAs(env, anna);
    await assertFails(getDoc(householdRef(db, "real")));
    await assertFails(getDocs(collection(db, "households", "real", "tasks")));
    await assertFails(getDoc(doc(db, "invites", "REA-1234")));
  });
});

describe("invite lookup (C7)", () => {
  it("lets users without a household get any code", async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, lea), "invites", CODE)));
  });

  it("lets members get their own code and codes that don't exist", async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, anna), "invites", CODE)));
    await assertSucceeds(getDoc(doc(dbAs(env, anna), "invites", "XYZ-0000")));
  });

  it("denies members of another household someone else's code", async () => {
    await seedHousehold(env, { hid: "other", owner: lea, code: "OTH-1234", name: "Andere" });
    await assertFails(getDoc(doc(dbAs(env, anna), "invites", "OTH-1234")));
    expect((await getDoc(doc(dbAs(env, lea), "invites", "OTH-1234"))).exists()).toBe(true);
  });
});
