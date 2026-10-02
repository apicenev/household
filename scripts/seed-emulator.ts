/**
 * Seeds the local Firebase emulators with the test accounts:
 *   nevio@example.ch, anna@example.ch   (Auth display name seeds the profile on first login)
 * Password for all: household-dev
 *
 * With `--household` (Phase 2) it also creates «Musterstrasse 12» with Nevio as owner and
 * prints its invite code. Anna stays without a household, so the join flow can be tested in
 * a second browser profile.
 *
 * Usage: npm run emulators (in another terminal), then `npm run seed` or
 * `npm run seed -- --household`.
 * Idempotent: existing users and documents are left as they are; an expired code is replaced.
 * Refuses to run against anything but the emulators.
 */
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { generateInviteCode, inviteExpiresAt, isInviteExpired } from "../src/domain/invite";
import { avatarColorFor, initialsFor } from "../src/domain/member";

const PROJECT_ID = "demo-household";
const AUTH_HOST = "127.0.0.1:9099";
const FIRESTORE_HOST = "127.0.0.1:8180";
const PASSWORD = "household-dev";
const HOUSEHOLD_NAME = "Musterstrasse 12";

const accounts = [
  { email: "nevio@example.ch", displayName: "Nevio" },
  { email: "anna@example.ch", displayName: "Anna" },
];

// Force the emulator hosts; the Admin SDK only talks to the emulators when these are set.
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;
process.env.GCLOUD_PROJECT = PROJECT_ID;
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

function assertEmulatorOnly() {
  const local = (host: string | undefined) =>
    host !== undefined && /^(127\.0\.0\.1|localhost):\d+$/.test(host);
  if (
    !PROJECT_ID.startsWith("demo-") ||
    !local(process.env.FIREBASE_AUTH_EMULATOR_HOST) ||
    !local(process.env.FIRESTORE_EMULATOR_HOST)
  ) {
    throw new Error("Refusing to seed: this script only runs against the local emulators.");
  }
}

async function emulatorsRunning(): Promise<boolean> {
  try {
    await Promise.all([fetch(`http://${AUTH_HOST}/`), fetch(`http://${FIRESTORE_HOST}/`)]);
    return true;
  } catch {
    return false;
  }
}

/** A code no invite uses yet. */
async function freeInviteCode(db: Firestore): Promise<string> {
  for (;;) {
    const code = generateInviteCode();
    if (!(await db.doc(`invites/${code}`).get()).exists) return code;
  }
}

/**
 * «Musterstrasse 12» with Nevio as owner, written like householdService.createHousehold
 * (household, owner member doc, invite, profile householdId). Returns the current code.
 */
async function seedHousehold(db: Firestore, uid: string, displayName: string): Promise<string> {
  const profileRef = db.doc(`users/${uid}`);
  const profile = (await profileRef.get()).data();
  const existingId = profile?.householdId as string | null | undefined;

  if (existingId) {
    const household = (await db.doc(`households/${existingId}`).get()).data();
    if (household) {
      const createdAt = (household.inviteCreatedAt as Timestamp).toDate();
      if (!isInviteExpired(createdAt)) {
        console.log(`= household «${household.name}» exists (${existingId})`);
        return household.inviteCode as string;
      }
      // Expired: replace the code like «Neuer Code».
      const code = await freeInviteCode(db);
      const now = Timestamp.now();
      const batch = db.batch();
      batch.delete(db.doc(`invites/${household.inviteCode}`));
      batch.set(db.doc(`invites/${code}`), {
        householdId: existingId,
        householdName: household.name,
        ownerName: displayName,
        memberCount: (household.memberIds as string[]).length,
        createdBy: uid,
        createdAt: now,
      });
      batch.update(db.doc(`households/${existingId}`), {
        inviteCode: code,
        inviteCreatedAt: now,
        updatedAt: now,
      });
      await batch.commit();
      console.log(`~ household «${household.name}»: expired code replaced`);
      return code;
    }
  }

  const name = (profile?.displayName as string | undefined) ?? displayName;
  const initials = (profile?.initials as string | undefined) ?? initialsFor(name);
  const avatarColor = (profile?.avatarColor as number | undefined) ?? avatarColorFor(uid);
  const hid = db.collection("households").doc().id;
  const code = await freeInviteCode(db);
  const now = Timestamp.now();
  const batch = db.batch();
  batch.set(db.doc(`households/${hid}`), {
    name: HOUSEHOLD_NAME,
    ownerId: uid,
    memberIds: [uid],
    weekStartsOn: 1,
    timeZone: "Europe/Zurich",
    inviteCode: code,
    inviteCreatedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  batch.set(db.doc(`households/${hid}/members/${uid}`), {
    displayName: name,
    initials,
    avatarColor,
    role: "owner",
    joinedAt: now,
  });
  batch.set(db.doc(`invites/${code}`), {
    householdId: hid,
    householdName: HOUSEHOLD_NAME,
    ownerName: name,
    memberCount: 1,
    createdBy: uid,
    createdAt: now,
  });
  if (profile) {
    batch.update(profileRef, { householdId: hid });
  } else {
    // Nevio hasn't logged in yet: create the profile as ensureUserProfile would.
    batch.set(profileRef, {
      displayName: name,
      email: accounts[0].email,
      initials,
      avatarColor,
      householdId: hid,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  console.log(`+ household «${HOUSEHOLD_NAME}» created (${hid})`);
  return code;
}

async function main() {
  assertEmulatorOnly();
  if (!(await emulatorsRunning())) {
    console.error("Emulators not reachable. Start them first with `npm run emulators`.");
    process.exit(1);
  }

  const withHousehold = process.argv.includes("--household");
  const app = initializeApp({ projectId: PROJECT_ID });
  const auth = getAuth(app);
  const uids: string[] = [];

  for (const account of accounts) {
    try {
      const { uid } = await auth.getUserByEmail(account.email);
      console.log(`= ${account.email} exists (${uid})`);
      uids.push(uid);
    } catch {
      const { uid } = await auth.createUser({
        email: account.email,
        password: PASSWORD,
        displayName: account.displayName,
      });
      console.log(`+ ${account.email} created (${uid})`);
      uids.push(uid);
    }
  }

  if (withHousehold) {
    const db = getFirestore(app);
    const code = await seedHousehold(db, uids[0], accounts[0].displayName);
    const invite = (await db.doc(`invites/${code}`).get()).data();
    const validUntil = inviteExpiresAt((invite?.createdAt as Timestamp).toDate());
    console.log(
      `\nInvite code: ${code} (valid until ${validUntil.toLocaleString("de-CH")}).` +
        `\nLog in as ${accounts[1].email} in a second browser profile and join with it.`,
    );
  }

  console.log(`\nDone. Password for all accounts: ${PASSWORD}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
