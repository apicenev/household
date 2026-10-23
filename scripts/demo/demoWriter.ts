import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { buildDemoData, type DemoDoc, type DemoUser } from "../../src/demo/demoData";
import { generateInviteCode } from "../../src/domain/invite";

/**
 * Writes the demo household (Phase 9 C6, §9.11) with the Admin SDK: shared by
 * `npm run demo:setup` (the real project) and `npm run seed -- --demo` (the emulators).
 * It only ever touches the two demo users' profiles, their household and its invite.
 */

/** The demo household's id. Fixed, so the script finds it again. */
export const DEMO_HOUSEHOLD_ID = "demo-haushalt";

/** Sub-collections of a household, deleted on `--reset`. */
const CONTENT = ["tasks", "shoppingItems", "itemStats", "events", "activity", "members"];

export type DemoState =
  | { kind: "fresh" }
  | { kind: "existing"; householdId: string; inviteCode: string }
  | { kind: "refused"; reason: string };

/** The two accounts by email, in that order. Throws if one doesn't exist. */
export async function findDemoUsers(auth: Auth, emails: readonly string[]): Promise<DemoUser[]> {
  if (emails.length !== 2) throw new Error("Pass exactly two emails: --emails a@…,b@…");
  const users: DemoUser[] = [];
  for (const email of emails) {
    try {
      const record = await auth.getUserByEmail(email);
      users.push({ uid: record.uid, email: record.email ?? email });
    } catch {
      throw new Error(`No account for ${email}. Create it in the Firebase console first.`);
    }
  }
  if (users[0].uid === users[1].uid) throw new Error("The two emails are the same account.");
  return users;
}

/**
 * Where the two accounts stand (C6): neither in a household → fresh; both the only members of
 * a household with `demo: true` → existing; anything else → refused, nothing is touched.
 */
export async function demoState(db: Firestore, users: readonly DemoUser[]): Promise<DemoState> {
  const profiles = await Promise.all(users.map((user) => db.doc(`users/${user.uid}`).get()));
  const ids = profiles.map((profile) => (profile.data()?.householdId ?? null) as string | null);
  if (ids.every((id) => id === null)) {
    const taken = (await db.doc(`households/${DEMO_HOUSEHOLD_ID}`).get()).data();
    if (taken && taken.demo !== true) {
      return {
        kind: "refused",
        reason: `households/${DEMO_HOUSEHOLD_ID} exists and isn't a demo.`,
      };
    }
    return { kind: "fresh" };
  }
  if (ids[0] === null || ids[0] !== ids[1]) {
    return {
      kind: "refused",
      reason: "The two accounts are in different households, or only one is in one.",
    };
  }
  const household = (await db.doc(`households/${ids[0]}`).get()).data();
  const members = (household?.memberIds ?? []) as string[];
  const both = users.every((user) => members.includes(user.uid)) && members.length === 2;
  if (!household || household.demo !== true || !both) {
    return {
      kind: "refused",
      reason: `Household ${ids[0]} isn't a demo household of exactly these two accounts.`,
    };
  }
  return { kind: "existing", householdId: ids[0], inviteCode: household.inviteCode as string };
}

/** A code no invite uses yet. */
async function freeInviteCode(db: Firestore): Promise<string> {
  for (;;) {
    const code = generateInviteCode();
    if (!(await db.doc(`invites/${code}`).get()).exists) return code;
  }
}

/** Deletes the demo household's content and its invite (`--reset`); returns how many docs. */
export async function deleteDemoContent(
  db: Firestore,
  householdId: string,
  inviteCode: string,
  dryRun: boolean,
): Promise<number> {
  let count = 0;
  for (const name of CONTENT) {
    const snapshot = await db.collection(`households/${householdId}/${name}`).get();
    count += snapshot.size;
    if (dryRun) continue;
    for (let start = 0; start < snapshot.size; start += 500) {
      const batch = db.batch();
      for (const d of snapshot.docs.slice(start, start + 500)) batch.delete(d.ref);
      await batch.commit();
    }
  }
  const invite = db.doc(`invites/${inviteCode}`);
  if ((await invite.get()).exists) {
    count += 1;
    if (!dryRun) await invite.delete();
  }
  return count;
}

/** Writes the documents in batches of 500 (set, so a rerun overwrites). */
async function writeDocs(db: Firestore, docs: readonly DemoDoc[]): Promise<void> {
  for (let start = 0; start < docs.length; start += 500) {
    const batch = db.batch();
    for (const { path, data } of docs.slice(start, start + 500)) batch.set(db.doc(path), data);
    await batch.commit();
  }
}

export interface WriteDemoOptions {
  users: readonly [DemoUser, DemoUser];
  /** The existing demo household on `--reset`; DEMO_HOUSEHOLD_ID for a fresh one. */
  householdId?: string;
  now?: Date;
  /** Screenshots only (§9.15). */
  dueToday?: boolean;
  dryRun?: boolean;
}

/** Builds and writes the demo household; returns the documents written (or to write). */
export async function writeDemo(db: Firestore, options: WriteDemoOptions): Promise<DemoDoc[]> {
  const inviteCode = await freeInviteCode(db);
  const { docs } = buildDemoData({
    now: options.now ?? new Date(),
    householdId: options.householdId ?? DEMO_HOUSEHOLD_ID,
    inviteCode,
    users: options.users,
    dueToday: options.dueToday,
  });
  if (!options.dryRun) await writeDocs(db, docs);
  return docs;
}
