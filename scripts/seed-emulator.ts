/**
 * Seeds the local Firebase emulators with the Phase 1 test accounts:
 *   nevio@example.ch, anna@example.ch   (Auth display name seeds the profile on first login)
 * Password for all: household-dev
 *
 * Usage: npm run emulators (in another terminal), then npm run seed.
 * Idempotent: existing users and documents are left as they are.
 * Refuses to run against anything but the emulators.
 */
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const PROJECT_ID = "demo-household";
const AUTH_HOST = "127.0.0.1:9099";
const FIRESTORE_HOST = "127.0.0.1:8180";
const PASSWORD = "household-dev";

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

async function main() {
  assertEmulatorOnly();
  if (!(await emulatorsRunning())) {
    console.error("Emulators not reachable. Start them first with `npm run emulators`.");
    process.exit(1);
  }

  const app = initializeApp({ projectId: PROJECT_ID });
  const auth = getAuth(app);

  for (const account of accounts) {
    try {
      const { uid } = await auth.getUserByEmail(account.email);
      console.log(`= ${account.email} exists (${uid})`);
    } catch {
      const { uid } = await auth.createUser({
        email: account.email,
        password: PASSWORD,
        displayName: account.displayName,
      });
      console.log(`+ ${account.email} created (${uid})`);
    }
  }

  console.log(`\nDone. Password for all accounts: ${PASSWORD}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
