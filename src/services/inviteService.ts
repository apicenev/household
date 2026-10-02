import {
  arrayUnion,
  doc,
  getDocFromServer,
  increment,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { generateInviteCode, isInviteExpired } from "../domain/invite";
import { inviteConverter } from "../lib/converters/inviteConverter";
import { db } from "../lib/firebase";
import { firestoreErrorCode } from "../lib/firestoreErrors";
import type { Household, Invite, UserProfile } from "../types";
import { record } from "./activityService";

/** How many random codes are tried before giving up on a collision. */
const CODE_ATTEMPTS = 3;

function inviteRef(code: string) {
  return doc(db, "invites", code).withConverter(inviteConverter);
}

/**
 * The invite for a code, or null if there is none. Always read from the server: a cached
 * invite can be expired or replaced, and the read fails fast (`unavailable`) without a
 * real connection.
 */
export async function getInvite(code: string): Promise<Invite | null> {
  const snapshot = await getDocFromServer(inviteRef(code));
  return snapshot.exists() ? snapshot.data() : null;
}

/** A random code no invite uses yet (checked on the server, up to three tries). */
export async function findFreeInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const code = generateInviteCode();
    const existing = await getDocFromServer(inviteRef(code));
    if (!existing.exists()) return code;
  }
  throw new Error("No free invite code found.");
}

/**
 * Runs `write` with a free code. If another household takes the code between the check and
 * the commit, the rules reject the batch (`permission-denied`); then it's retried once with
 * a new code.
 */
export async function withFreeInviteCode<T>(write: (code: string) => Promise<T>): Promise<T> {
  try {
    return await write(await findFreeInviteCode());
  } catch (error) {
    if (firestoreErrorCode(error) !== "permission-denied") throw error;
    return write(await findFreeInviteCode());
  }
}

/**
 * «Neuer Code» (HH-03, owner only): deletes the old invite, creates a new one and points
 * the household at it, in one batch. The old code stops working at once.
 */
export async function regenerateInvite(household: Household, owner: UserProfile): Promise<string> {
  return withFreeInviteCode(async (code) => {
    const batch = writeBatch(db);
    batch.delete(doc(db, "invites", household.inviteCode));
    batch.set(doc(db, "invites", code), {
      householdId: household.id,
      householdName: household.name,
      ownerName: owner.displayName,
      memberCount: household.memberIds.length,
      createdBy: owner.uid,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, "households", household.id), {
      inviteCode: code,
      inviteCreatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return code;
  });
}

export type JoinErrorReason = "not-found" | "expired" | "offline" | "failed";

/** Why joining didn't work; the onboarding screen shows a matching message. */
export class JoinError extends Error {
  readonly reason: JoinErrorReason;

  constructor(reason: JoinErrorReason, options?: { cause?: unknown }) {
    super(`Join failed: ${reason}`, options);
    this.name = "JoinError";
    this.reason = reason;
  }
}

/** What's wrong with a code on the server right now, or null if it's valid. */
async function inviteProblem(code: string): Promise<"not-found" | "expired" | null> {
  const invite = await getInvite(code);
  if (!invite) return "not-found";
  if (isInviteExpired(invite.createdAt)) return "expired";
  return null;
}

function toJoinError(error: unknown): JoinError {
  if (error instanceof JoinError) return error;
  const reason = firestoreErrorCode(error) === "unavailable" ? "offline" : "failed";
  return new JoinError(reason, { cause: error });
}

/** After a rejected batch: gone → «gibt es nicht», still there → expired by server time. */
async function rejectedJoinError(code: string, cause: unknown): Promise<JoinError> {
  try {
    const problem = await inviteProblem(code);
    return new JoinError(problem === "not-found" ? "not-found" : "expired", { cause });
  } catch (lookupError) {
    return toJoinError(lookupError);
  }
}

/**
 * Joins the household of `invite` (HH-02) in one batch: memberIds, the own member doc (with
 * the code as proof), the profile's householdId, the invite's member count and the
 * «member_joined» activity entry. Throws a JoinError.
 */
export async function joinHousehold(invite: Invite, profile: UserProfile): Promise<void> {
  let problem: Awaited<ReturnType<typeof inviteProblem>>;
  try {
    // Catches a code that was replaced or expired since it was looked up.
    problem = await inviteProblem(invite.code);
  } catch (error) {
    throw toJoinError(error);
  }
  if (problem) throw new JoinError(problem);

  const hid = invite.householdId;
  const batch = writeBatch(db);
  // Never the whole array: the joiner can't read the household, and arrayUnion keeps
  // concurrent joins correct.
  batch.update(doc(db, "households", hid), {
    memberIds: arrayUnion(profile.uid),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, "households", hid, "members", profile.uid), {
    displayName: profile.displayName,
    initials: profile.initials,
    avatarColor: profile.avatarColor,
    role: "member",
    joinedAt: serverTimestamp(),
    joinedWithCode: invite.code,
  });
  batch.update(doc(db, "users", profile.uid), { householdId: hid });
  batch.update(doc(db, "invites", invite.code), { memberCount: increment(1) });
  record(batch, hid, {
    actorId: profile.uid,
    type: "member_joined",
    targetType: "member",
    targetId: profile.uid,
    targetTitle: profile.displayName,
  });

  try {
    await batch.commit();
  } catch (error) {
    // The server disagrees with the lookup: the code is gone, or expired by server time
    // (e.g. a wrong phone clock showed «Code gefunden»).
    if (firestoreErrorCode(error) === "permission-denied") {
      throw await rejectedJoinError(invite.code, error);
    }
    throw toJoinError(error);
  }
}
