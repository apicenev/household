/**
 * Seeds the local Firebase emulators with the test accounts:
 *   nevio@example.ch, anna@example.ch   (Auth display name seeds the profile on first login)
 * Password for all: household-dev
 *
 * With `--household` (Phase 2) it also creates «Musterstrasse 12» with Nevio as owner and
 * prints its invite code. Anna stays without a household, so the join flow can be tested in
 * a second browser profile. Since Phase 3 the household also gets the design's example tasks
 * (relative to today), unless it has tasks already. Since Phase 4 it also gets three recurring
 * tasks with fixed ids, added whenever they're missing (also to a household seeded before).
 *
 * With `--with-anna` (Phase 4, implies `--household`) Anna joins «Musterstrasse 12» like
 * joinHousehold would, and «Bad putzen» rotates Nevio → Anna.
 *
 * Usage: npm run emulators (in another terminal), then `npm run seed`,
 * `npm run seed -- --household` or `npm run seed -- --with-anna`.
 * Idempotent: existing users and documents are left as they are; an expired code is replaced.
 * Refuses to run against anything but the emulators.
 */
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { weekdayOfKey } from "../src/domain/dateKeys";
import { generateInviteCode, inviteExpiresAt, isInviteExpired } from "../src/domain/invite";
import { avatarColorFor, initialsFor } from "../src/domain/member";
import { todayKey } from "../src/domain/tasks";

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
 * (household, owner member doc, invite, profile householdId). Returns its id and code.
 */
async function seedHousehold(
  db: Firestore,
  uid: string,
  displayName: string,
): Promise<{ hid: string; code: string }> {
  const profileRef = db.doc(`users/${uid}`);
  const profile = (await profileRef.get()).data();
  const existingId = profile?.householdId as string | null | undefined;

  if (existingId) {
    const household = (await db.doc(`households/${existingId}`).get()).data();
    if (household) {
      const createdAt = (household.inviteCreatedAt as Timestamp).toDate();
      if (!isInviteExpired(createdAt)) {
        console.log(`= household «${household.name}» exists (${existingId})`);
        return { hid: existingId, code: household.inviteCode as string };
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
      return { hid: existingId, code };
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
  return { hid, code };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Date key `days` days from today in Zurich. */
function dayFromToday(days: number): string {
  return todayKey(new Date(Date.now() + days * DAY_MS), "Europe/Zurich");
}

/**
 * The example tasks of `Tasks.dc.html` (Phase 3 §3.8), relative to today, plus two completed
 * ones. Skipped when the household has tasks already, so reruns don't duplicate them.
 */
async function seedTasks(db: Firestore, hid: string, ownerUid: string): Promise<void> {
  const tasks = db.collection(`households/${hid}/tasks`);
  if (!(await tasks.limit(1).get()).empty) {
    console.log("= tasks exist");
    return;
  }
  const now = Timestamp.now();
  const open = [
    {
      title: "Altpapier rausbringen",
      notes: "Papier bündeln und vor 20:00 rausstellen.",
      assigneeId: ownerUid,
      dueDate: dayFromToday(0),
      priority: "low",
    },
    { title: "Küche putzen", assigneeId: null, dueDate: dayFromToday(0), priority: "high" },
    {
      title: "Vermieter wegen Heizung anrufen",
      notes: "Heizkörper im Schlafzimmer bleibt kalt.",
      assigneeId: null,
      dueDate: null,
      priority: "low",
    },
  ];
  const done = [
    { title: "Bad putzen", assigneeId: ownerUid, dueDate: dayFromToday(-2), daysAgo: 1 },
    { title: "Altpapier rausbringen", assigneeId: ownerUid, dueDate: dayFromToday(-3), daysAgo: 3 },
  ];
  const batch = db.batch();
  for (const task of open) {
    batch.set(tasks.doc(), {
      ...task,
      status: "open",
      createdBy: ownerUid,
      createdAt: now,
      updatedAt: now,
    });
  }
  for (const { daysAgo, ...task } of done) {
    batch.set(tasks.doc(), {
      ...task,
      priority: "low",
      status: "done",
      completedAt: Timestamp.fromMillis(Date.now() - daysAgo * DAY_MS),
      completedBy: ownerUid,
      createdBy: ownerUid,
      createdAt: now,
      updatedAt: now,
    });
  }
  await batch.commit();
  console.log(`+ ${open.length} open and ${done.length} completed tasks`);
}

/** First date from today (inclusive) on the given weekday (0 = Sunday … 6 = Saturday). */
function nextWeekday(weekday: number): string {
  for (let days = 0; ; days++) {
    const key = dayFromToday(days);
    if (weekdayOfKey(key) === weekday) return key;
  }
}

/**
 * Recurring examples of `Tasks.dc.html` (Phase 4 §4.7) with fixed ids (each is the first
 * occurrence of its own series), so reruns add only the missing ones. «Bad putzen» rotates
 * Nevio → Anna once Anna is a member.
 */
async function seedRecurringTasks(
  db: Firestore,
  hid: string,
  ownerUid: string,
  annaUid: string | null,
): Promise<void> {
  const now = Timestamp.now();
  const saturday = nextWeekday(6);
  const examples = [
    {
      id: "seed-water",
      title: "Pflanzen giessen",
      notes: "Küchenkräuter, Monstera und Balkonkisten.",
      assigneeId: ownerUid,
      dueDate: dayFromToday(-1),
      priority: "low",
      recurrence: { freq: "daily", interval: 4 },
    },
    {
      id: "seed-sheets",
      title: "Bettwäsche wechseln",
      assigneeId: ownerUid,
      dueDate: nextWeekday(0),
      priority: "medium",
      recurrence: { freq: "weekly", interval: 2, byWeekday: [0] },
    },
    {
      id: "seed-bathroom",
      title: "Bad putzen",
      notes: "Dusche, Lavabo, WC und Spiegel. Zum Schluss feucht aufnehmen.",
      assigneeId: ownerUid,
      dueDate: saturday,
      priority: "low",
      recurrence: { freq: "weekly", interval: 1, byWeekday: [6] },
      ...(annaUid ? { rotation: { memberIds: [ownerUid, annaUid], index: 0 } } : {}),
    },
  ];
  let added = 0;
  for (const { id, ...task } of examples) {
    const ref = db.doc(`households/${hid}/tasks/${id}`);
    const existing = await ref.get();
    if (existing.exists) {
      // A rerun with --with-anna turns on the rotation of an untouched «Bad putzen».
      const data = existing.data();
      if ("rotation" in task && data?.status === "open" && !data.rotation) {
        await ref.update({ rotation: task.rotation, assigneeId: ownerUid, updatedAt: now });
        console.log(`~ «${task.title}» rotates Nevio → Anna`);
      }
      continue;
    }
    await ref.set({
      ...task,
      seriesId: id,
      seriesIndex: 1,
      status: "open",
      createdBy: ownerUid,
      createdAt: now,
      updatedAt: now,
    });
    added += 1;
  }
  console.log(added > 0 ? `+ ${added} recurring tasks` : "= recurring tasks exist");
}

/**
 * Anna joins «Musterstrasse 12» (Phase 4, `--with-anna`), written like
 * inviteService.joinHousehold. Skipped if she's in a household already.
 */
async function seedAnnaJoin(db: Firestore, hid: string, code: string, uid: string) {
  const profileRef = db.doc(`users/${uid}`);
  const profile = (await profileRef.get()).data();
  if (profile?.householdId) {
    console.log(`= ${accounts[1].email} is in a household (${profile.householdId as string})`);
    return;
  }
  const name = (profile?.displayName as string | undefined) ?? accounts[1].displayName;
  const initials = (profile?.initials as string | undefined) ?? initialsFor(name);
  const avatarColor = (profile?.avatarColor as number | undefined) ?? avatarColorFor(uid);
  const now = Timestamp.now();
  const batch = db.batch();
  batch.update(db.doc(`households/${hid}`), {
    memberIds: FieldValue.arrayUnion(uid),
    updatedAt: now,
  });
  batch.set(db.doc(`households/${hid}/members/${uid}`), {
    displayName: name,
    initials,
    avatarColor,
    role: "member",
    joinedAt: now,
    joinedWithCode: code,
  });
  if (profile) {
    batch.update(profileRef, { householdId: hid });
  } else {
    batch.set(profileRef, {
      displayName: name,
      email: accounts[1].email,
      initials,
      avatarColor,
      householdId: hid,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  batch.update(db.doc(`invites/${code}`), { memberCount: FieldValue.increment(1) });
  batch.set(db.collection(`households/${hid}/activity`).doc(), {
    actorId: uid,
    type: "member_joined",
    targetType: "member",
    targetId: uid,
    targetTitle: name,
    createdAt: now,
  });
  await batch.commit();
  console.log(`+ ${accounts[1].email} joined «${HOUSEHOLD_NAME}»`);
}

async function main() {
  assertEmulatorOnly();
  if (!(await emulatorsRunning())) {
    console.error("Emulators not reachable. Start them first with `npm run emulators`.");
    process.exit(1);
  }

  const withAnna = process.argv.includes("--with-anna");
  const withHousehold = withAnna || process.argv.includes("--household");
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
    const { hid, code } = await seedHousehold(db, uids[0], accounts[0].displayName);
    if (withAnna) await seedAnnaJoin(db, hid, code, uids[1]);
    await seedTasks(db, hid, uids[0]);
    const memberIds = ((await db.doc(`households/${hid}`).get()).data()?.memberIds ??
      []) as string[];
    await seedRecurringTasks(db, hid, uids[0], memberIds.includes(uids[1]) ? uids[1] : null);
    const invite = (await db.doc(`invites/${code}`).get()).data();
    const validUntil = inviteExpiresAt((invite?.createdAt as Timestamp).toDate());
    console.log(
      `\nInvite code: ${code} (valid until ${validUntil.toLocaleString("de-CH")}).` +
        (withAnna
          ? `\n${accounts[1].email} is a member too; log in as her in a second browser profile.`
          : `\nLog in as ${accounts[1].email} in a second browser profile and join with it.`),
    );
  }

  console.log(`\nDone. Password for all accounts: ${PASSWORD}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
