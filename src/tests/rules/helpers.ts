import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import {
  arrayUnion,
  collection,
  doc,
  increment,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";

export interface TestUser {
  uid: string;
  email: string;
  displayName: string;
  initials: string;
  avatarColor: number;
}

export const nevio: TestUser = {
  uid: "nevio",
  email: "nevio@example.ch",
  displayName: "Nevio",
  initials: "NE",
  avatarColor: 3,
};
export const anna: TestUser = {
  uid: "anna",
  email: "anna@example.ch",
  displayName: "Anna",
  initials: "AN",
  avatarColor: 6,
};
/** Outsider: neither a member of the test household nor (by default) of any other. */
export const lea: TestUser = {
  uid: "lea",
  email: "lea@example.ch",
  displayName: "Lea",
  initials: "LE",
  avatarColor: 1,
};

export const HID = "h1";
export const CODE = "MST-4821";
export const DAY_MS = 24 * 60 * 60 * 1000;

export async function createTestEnvironment(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: "demo-household",
    firestore: {
      // host/port come from FIRESTORE_EMULATOR_HOST, set by `firebase emulators:exec`
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
}

/** Firestore as the given user (the compat instance works with the modular API). */
export function dbAs(env: RulesTestEnvironment, user: TestUser): Firestore {
  return env
    .authenticatedContext(user.uid, { email: user.email })
    .firestore() as unknown as Firestore;
}

export function unauthenticatedDb(env: RulesTestEnvironment): Firestore {
  return env.unauthenticatedContext().firestore() as unknown as Firestore;
}

/** Runs `fn` with a Firestore that bypasses the rules (seeding, backdating). */
export async function asAdmin(
  env: RulesTestEnvironment,
  fn: (db: Firestore) => Promise<unknown>,
): Promise<void> {
  await env.withSecurityRulesDisabled(async (context) => {
    await fn(context.firestore() as unknown as Firestore);
  });
}

export function profileDoc(user: TestUser, householdId: string | null = null) {
  return {
    displayName: user.displayName,
    email: user.email,
    initials: user.initials,
    avatarColor: user.avatarColor,
    householdId,
    createdAt: new Date(2026, 8, 1),
  };
}

export async function seedProfiles(env: RulesTestEnvironment, ...users: TestUser[]) {
  await asAdmin(env, async (db) => {
    for (const user of users) await setDoc(doc(db, "users", user.uid), profileDoc(user));
  });
}

interface SeedHouseholdOptions {
  hid?: string;
  owner?: TestUser;
  members?: TestUser[];
  code?: string;
  name?: string;
  /** When the current code was created (default: now). */
  inviteCreatedAt?: Date;
  memberCount?: number;
}

/**
 * Seeds a complete household as the create (and join) batches would leave it: household,
 * member docs, invite and the members' profiles with householdId.
 */
export async function seedHousehold(env: RulesTestEnvironment, options: SeedHouseholdOptions = {}) {
  const {
    hid = HID,
    owner = nevio,
    members = [],
    code = CODE,
    name = "Musterstrasse 12",
    inviteCreatedAt = new Date(),
  } = options;
  const all = [owner, ...members];
  await asAdmin(env, async (db) => {
    const now = new Date();
    await setDoc(doc(db, "households", hid), {
      name,
      ownerId: owner.uid,
      memberIds: all.map((m) => m.uid),
      weekStartsOn: 1,
      timeZone: "Europe/Zurich",
      inviteCode: code,
      inviteCreatedAt,
      createdAt: now,
      updatedAt: now,
    });
    for (const member of all) {
      await setDoc(doc(db, "households", hid, "members", member.uid), {
        displayName: member.displayName,
        initials: member.initials,
        avatarColor: member.avatarColor,
        role: member === owner ? "owner" : "member",
        joinedAt: now,
        ...(member === owner ? {} : { joinedWithCode: code }),
      });
      await setDoc(doc(db, "users", member.uid), profileDoc(member, hid));
    }
    await setDoc(doc(db, "invites", code), {
      householdId: hid,
      householdName: name,
      ownerName: owner.displayName,
      memberCount: options.memberCount ?? all.length,
      createdBy: owner.uid,
      createdAt: inviteCreatedAt,
    });
  });
}

/** Parts of a batch a test can leave out or override. */
interface CreateBatchOptions {
  hid?: string;
  code?: string;
  household?: Record<string, unknown>;
  member?: Record<string, unknown> | false;
  invite?: Record<string, unknown> | false;
  user?: Record<string, unknown> | false;
}

/** The create batch as householdService.createHousehold writes it. */
export function createBatch(db: Firestore, user: TestUser, options: CreateBatchOptions = {}) {
  const { hid = HID, code = CODE } = options;
  const batch = writeBatch(db);
  batch.set(doc(db, "households", hid), {
    name: "Musterstrasse 12",
    ownerId: user.uid,
    memberIds: [user.uid],
    weekStartsOn: 1,
    timeZone: "Europe/Zurich",
    inviteCode: code,
    inviteCreatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...options.household,
  });
  if (options.member !== false) {
    batch.set(doc(db, "households", hid, "members", user.uid), {
      displayName: user.displayName,
      initials: user.initials,
      avatarColor: user.avatarColor,
      role: "owner",
      joinedAt: serverTimestamp(),
      ...options.member,
    });
  }
  if (options.invite !== false) {
    batch.set(doc(db, "invites", code), {
      householdId: hid,
      householdName: "Musterstrasse 12",
      ownerName: user.displayName,
      memberCount: 1,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      ...options.invite,
    });
  }
  if (options.user !== false) {
    batch.update(doc(db, "users", user.uid), { householdId: hid, ...options.user });
  }
  return batch;
}

interface JoinBatchOptions {
  hid?: string;
  code?: string;
  household?: Record<string, unknown>;
  member?: Record<string, unknown> | false;
  user?: Record<string, unknown> | false;
  invite?: Record<string, unknown> | false;
  activity?: Record<string, unknown> | false;
}

/** The join batch as inviteService.joinHousehold writes it. */
export function joinBatch(db: Firestore, user: TestUser, options: JoinBatchOptions = {}) {
  const { hid = HID, code = CODE } = options;
  const batch = writeBatch(db);
  batch.update(doc(db, "households", hid), {
    memberIds: arrayUnion(user.uid),
    updatedAt: serverTimestamp(),
    ...options.household,
  });
  if (options.member !== false) {
    batch.set(doc(db, "households", hid, "members", user.uid), {
      displayName: user.displayName,
      initials: user.initials,
      avatarColor: user.avatarColor,
      role: "member",
      joinedAt: serverTimestamp(),
      joinedWithCode: code,
      ...options.member,
    });
  }
  if (options.user !== false) {
    batch.update(doc(db, "users", user.uid), { householdId: hid, ...options.user });
  }
  if (options.invite !== false) {
    batch.update(doc(db, "invites", code), { memberCount: increment(1), ...options.invite });
  }
  if (options.activity !== false) {
    batch.set(doc(collection(db, "households", hid, "activity")), {
      actorId: user.uid,
      type: "member_joined",
      targetType: "member",
      targetId: user.uid,
      targetTitle: user.displayName,
      createdAt: serverTimestamp(),
      ...options.activity,
    });
  }
  return batch;
}

/** The «Neuer Code» batch as inviteService.regenerateInvite writes it. */
export function newCodeBatch(
  db: Firestore,
  owner: TestUser,
  newCode: string,
  options: { hid?: string; oldCode?: string; deleteOld?: boolean; memberCount?: number } = {},
) {
  const { hid = HID, oldCode = CODE, deleteOld = true, memberCount = 1 } = options;
  const batch = writeBatch(db);
  if (deleteOld) batch.delete(doc(db, "invites", oldCode));
  batch.set(doc(db, "invites", newCode), {
    householdId: hid,
    householdName: "Musterstrasse 12",
    ownerName: owner.displayName,
    memberCount,
    createdBy: owner.uid,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, "households", hid), {
    inviteCode: newCode,
    inviteCreatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return batch;
}
