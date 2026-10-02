import { type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, collection, updateDoc, type Firestore } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Household, UserProfile } from "../../types";
import {
  DAY_MS,
  anna,
  asAdmin,
  createTestEnvironment,
  dbAs,
  lea,
  nevio,
  seedProfiles,
  type TestUser,
} from "./helpers";

// The real services, talking to the emulator as the current test user, so their batches
// are checked by the real rules.
const current = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("../../lib/firebase", () => ({
  get db() {
    return current.db;
  },
}));

const { createHousehold, updateHouseholdSettings } =
  await import("../../services/householdService");
const { getInvite, joinHousehold, regenerateInvite } = await import("../../services/inviteService");
const { updateMyProfile } = await import("../../services/memberService");
const { householdConverter } = await import("../../lib/converters/householdConverter");
const { listenToUserProfile } = await import("../../services/userService");
const { nextConfirmedHouseholdId } = await import("../../lib/auth/confirmedHouseholdId");

let env: RulesTestEnvironment;

function signInAs(user: TestUser): Firestore {
  const db = dbAs(env, user);
  current.db = db;
  return db;
}

function profileOf(user: TestUser, householdId?: string): UserProfile {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    initials: user.initials,
    avatarColor: user.avatarColor as UserProfile["avatarColor"],
    householdId,
    createdAt: new Date(2026, 8, 1),
  };
}

async function readHousehold(hid: string): Promise<Household> {
  let household: Household | undefined;
  await asAdmin(env, async (db) => {
    household = (await getDoc(doc(db, "households", hid).withConverter(householdConverter))).data();
  });
  if (!household) throw new Error(`household ${hid} missing`);
  return household;
}

async function adminData(path: string) {
  let data: Record<string, unknown> | undefined;
  await asAdmin(env, async (db) => {
    data = (await getDoc(doc(db, path))).data();
  });
  return data;
}

beforeAll(async () => {
  env = await createTestEnvironment();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedProfiles(env, nevio, anna, lea);
});

describe("services against the rules", () => {
  it("create → join → new code → settings → profile edits", async () => {
    signInAs(nevio);
    const hid = await createHousehold(profileOf(nevio), "Musterstrasse 12");
    let household = await readHousehold(hid);
    expect(household).toMatchObject({ ownerId: "nevio", memberIds: ["nevio"], weekStartsOn: 1 });
    expect(await adminData(`users/nevio`)).toMatchObject({ householdId: hid });

    signInAs(anna);
    const invite = await getInvite(household.inviteCode);
    expect(invite).toMatchObject({
      householdId: hid,
      householdName: "Musterstrasse 12",
      ownerName: "Nevio",
      memberCount: 1,
    });
    await joinHousehold(invite!, profileOf(anna));
    household = await readHousehold(hid);
    expect(household.memberIds).toEqual(["nevio", "anna"]);
    expect(await adminData(`invites/${household.inviteCode}`)).toMatchObject({ memberCount: 2 });
    const activity = await getDocs(
      collection(current.db as Firestore, "households", hid, "activity"),
    );
    expect(activity.docs.map((d) => d.data())).toMatchObject([
      { actorId: "anna", type: "member_joined", targetId: "anna", targetTitle: "Anna" },
    ]);

    signInAs(nevio);
    const oldCode = household.inviteCode;
    const newCode = await regenerateInvite(household, profileOf(nevio, hid));
    expect(newCode).not.toBe(oldCode);
    expect(await adminData(`invites/${oldCode}`)).toBeUndefined();
    household = await readHousehold(hid);
    expect(household.inviteCode).toBe(newCode);

    await updateHouseholdSettings(household, {
      name: "WG Linde",
      weekStartsOn: 0,
      timeZone: "Europe/Vienna",
    });
    household = await readHousehold(hid);
    expect(household).toMatchObject({ name: "WG Linde", weekStartsOn: 0 });
    expect(await adminData(`invites/${newCode}`)).toMatchObject({ householdName: "WG Linde" });

    await updateMyProfile(profileOf(nevio, hid), household, { displayName: "Nevio Apicella" });
    expect(await adminData(`households/${hid}/members/nevio`)).toMatchObject({
      displayName: "Nevio Apicella",
      initials: "NA",
    });
    expect(await adminData(`invites/${newCode}`)).toMatchObject({ ownerName: "Nevio Apicella" });

    signInAs(anna);
    await updateMyProfile(profileOf(anna, hid), household, { avatarColor: 2 });
    expect(await adminData(`households/${hid}/members/anna`)).toMatchObject({ avatarColor: 2 });
  });

  it("reports the old code after «Neuer Code» as not found", async () => {
    signInAs(nevio);
    const hid = await createHousehold(profileOf(nevio), "Musterstrasse 12");
    const household = await readHousehold(hid);

    signInAs(anna);
    const oldInvite = await getInvite(household.inviteCode);

    signInAs(nevio);
    await regenerateInvite(household, profileOf(nevio, hid));

    signInAs(anna);
    await expect(joinHousehold(oldInvite!, profileOf(anna))).rejects.toMatchObject({
      reason: "not-found",
    });
  });

  it("reports a code expired by server time even if the client thinks it's valid", async () => {
    signInAs(nevio);
    const hid = await createHousehold(profileOf(nevio), "Musterstrasse 12");
    const { inviteCode } = await readHousehold(hid);
    // Server: created 8 days ago (both copies, as always).
    const past = new Date(Date.now() - 8 * DAY_MS);
    await asAdmin(env, async (db) => {
      await updateDoc(doc(db, "households", hid), { inviteCreatedAt: past });
      await updateDoc(doc(db, "invites", inviteCode), { createdAt: past });
    });

    signInAs(anna);
    const invite = await getInvite(inviteCode);
    await expect(joinHousehold(invite!, profileOf(anna))).rejects.toMatchObject({
      reason: "expired",
    });

    // A client that still believes the code is fresh (wrong phone clock): the rules reject
    // the batch and the service maps that to «expired».
    vi.useFakeTimers({ now: past, toFake: ["Date"] });
    try {
      await expect(joinHousehold(invite!, profileOf(anna))).rejects.toMatchObject({
        reason: "expired",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports the new householdId as pending first, then confirmed (guards, §2.6)", async () => {
    signInAs(nevio);
    const seen: Array<{ householdId: string | null; pending: boolean }> = [];
    let confirmed: string | null | undefined;
    const stop = listenToUserProfile(
      nevio.uid,
      (profile, pending) => {
        seen.push({ householdId: profile?.householdId ?? null, pending });
        confirmed = nextConfirmedHouseholdId(confirmed, profile, pending);
      },
      (error) => {
        throw error;
      },
    );
    await vi.waitFor(() => expect(confirmed).toBeNull());

    const hid = await createHousehold(profileOf(nevio), "Musterstrasse 12");
    await vi.waitFor(() => expect(confirmed).toBe(hid));
    stop();

    // The local write showed up before the server confirmed it, and didn't count yet.
    const firstWithHousehold = seen.find((s) => s.householdId === hid);
    expect(firstWithHousehold).toEqual({ householdId: hid, pending: true });
    expect(seen.at(-1)).toEqual({ householdId: hid, pending: false });
  });

  it("denies a second household for the same user", async () => {
    signInAs(nevio);
    await createHousehold(profileOf(nevio), "Musterstrasse 12");
    await expect(createHousehold(profileOf(nevio), "Zweitwohnung")).rejects.toMatchObject({
      code: "permission-denied",
    });
  });
});
