/**
 * Sets up or resets the demo household (Phase 9 C6, §9.11) in the real project:
 *
 *   npm run demo:setup -- --emails demo1@…,demo2@… [--reset] [--dry-run] [--yes]
 *
 * Needs admin credentials: GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account key
 * kept outside the repository (C6). Runs only against
 * `household-apicella-dev`, or against the emulators when FIRESTORE_EMULATOR_HOST is set (then
 * only a `demo-…` project).
 *
 * - First run: both accounts without a household → profiles «Demo User 1/2», «Demo-Haushalt»
 *   with `demo: true`, members, invite and the dataset.
 * - Both already in their demo household: nothing, unless `--reset`, which deletes its content
 *   and writes it fresh (names and colours included).
 * - Anything else: refuses and changes nothing. Passwords are never touched.
 */
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { cert, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { deleteDemoContent, demoState, findDemoUsers, writeDemo } from "./demoWriter";

const REAL_PROJECT = "household-apicella-dev";

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index !== -1) return process.argv[index + 1];
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return inline?.slice(name.length + 1);
}

const flag = (name: string) => process.argv.includes(name);

/**
 * The admin app and its project, guarded (C6: a typo can't hit another project): the
 * emulators with a `demo-…` project, or the key file's project, which must be the real one.
 */
function adminApp(): { app: App; project: string } {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    const project = process.env.GCLOUD_PROJECT ?? "demo-household";
    if (!project.startsWith("demo-")) {
      throw new Error(`Refusing: emulator project ${project} isn't a demo- project.`);
    }
    return { app: initializeApp({ projectId: project }), project };
  }
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyFile) {
    throw new Error("Set GOOGLE_APPLICATION_CREDENTIALS to the service-account key file.");
  }
  const key = JSON.parse(readFileSync(keyFile, "utf8")) as { project_id?: string };
  if (key.project_id !== REAL_PROJECT) {
    throw new Error(`Refusing: the key is for ${key.project_id}, not ${REAL_PROJECT}.`);
  }
  return {
    app: initializeApp({ credential: cert(keyFile), projectId: key.project_id }),
    project: key.project_id,
  };
}

async function confirm(question: string): Promise<boolean> {
  if (flag("--yes")) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} Type «yes» to continue: `);
  rl.close();
  return answer.trim().toLowerCase() === "yes";
}

async function main() {
  const emails = (argValue("--emails") ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
  const reset = flag("--reset");
  const dryRun = flag("--dry-run");

  const { app, project } = adminApp();
  const db = getFirestore(app);
  const users = await findDemoUsers(getAuth(app), emails);
  const state = await demoState(db, users);
  console.log(`Project: ${project}${dryRun ? " (dry run, nothing is written)" : ""}`);
  console.log(`Accounts: ${users.map((user) => `${user.email} (${user.uid})`).join(", ")}`);

  if (state.kind === "refused") throw new Error(`Refusing: ${state.reason}`);
  if (state.kind === "existing" && !reset) {
    console.log(`= Demo household ${state.householdId} exists. Pass --reset to rebuild it.`);
    return;
  }

  const plan =
    state.kind === "existing"
      ? `Reset ${state.householdId}: delete its content and invite, write the dataset fresh.`
      : "Create the demo household and write the dataset.";
  console.log(plan);
  if (!dryRun && !(await confirm(`This writes to ${project}.`))) {
    console.log("Cancelled, nothing written.");
    return;
  }

  if (state.kind === "existing") {
    const deleted = await deleteDemoContent(db, state.householdId, state.inviteCode, dryRun);
    console.log(`${dryRun ? "Would delete" : "- deleted"} ${deleted} documents`);
  }
  const docs = await writeDemo(db, {
    users: [users[0], users[1]],
    householdId: state.kind === "existing" ? state.householdId : undefined,
    dryRun,
  });
  const byKind = new Map<string, number>();
  for (const { path } of docs) {
    const parts = path.split("/");
    const kind = parts.length > 2 ? parts[2] : parts[0];
    byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
  }
  console.log(
    `${dryRun ? "Would write" : "+ wrote"} ${docs.length} documents: ` +
      [...byKind].map(([kind, count]) => `${kind} ${count}`).join(", "),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
