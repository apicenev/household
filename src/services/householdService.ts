import {
  arrayRemove,
  collection,
  deleteField,
  doc,
  getDocsFromServer,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Unsubscribe,
  type WriteBatch,
} from "firebase/firestore";
import { memberCleanup, rotationOrderWithout, type TaskCleanup } from "../domain/member";
import { DEFAULT_HOUSEHOLD_TIME_ZONE } from "../domain/timeZones";
import { householdConverter } from "../lib/converters/householdConverter";
import { db } from "../lib/firebase";
import type { Household, HouseholdSettingsUpdate, Member, Task, UserProfile } from "../types";
import { record } from "./activityService";
import { withFreeInviteCode } from "./inviteService";

/**
 * Creates a household (HH-01) in one batch: the household, the owner's member doc, the
 * invite (HH-02) and the profile's householdId. Defaults: week starts on Monday,
 * Europe/Zurich (HH-07). `name` must already be validated (validateHouseholdName).
 * Returns the new household's id.
 */
export async function createHousehold(profile: UserProfile, name: string): Promise<string> {
  const hid = doc(collection(db, "households")).id;
  await withFreeInviteCode(async (code) => {
    const batch = writeBatch(db);
    batch.set(doc(db, "households", hid), {
      name,
      ownerId: profile.uid,
      memberIds: [profile.uid],
      weekStartsOn: 1,
      timeZone: DEFAULT_HOUSEHOLD_TIME_ZONE,
      inviteCode: code,
      inviteCreatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, "households", hid, "members", profile.uid), {
      displayName: profile.displayName,
      initials: profile.initials,
      avatarColor: profile.avatarColor,
      role: "owner",
      joinedAt: serverTimestamp(),
    });
    batch.set(doc(db, "invites", code), {
      householdId: hid,
      householdName: name,
      ownerName: profile.displayName,
      memberCount: 1,
      createdBy: profile.uid,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, "users", profile.uid), { householdId: hid });
    await batch.commit();
  });
  return hid;
}

/**
 * Changes name, week start or time zone (HH-07, owner only). A new name also goes to the
 * invite preview, in the same batch.
 */
export async function updateHouseholdSettings(
  household: Household,
  update: HouseholdSettingsUpdate,
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "households", household.id), { ...update, updatedAt: serverTimestamp() });
  if (update.name !== undefined && update.name !== household.name) {
    batch.update(doc(db, "invites", household.inviteCode), { householdName: update.name });
  }
  await batch.commit();
}

/** Realtime household; `onChange(null)` if it doesn't exist. */
export function listenToHousehold(
  householdId: string,
  onChange: (household: Household | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, "households", householdId).withConverter(householdConverter),
    (snapshot) => onChange(snapshot.exists() ? snapshot.data() : null),
    onError,
  );
}

/** Writes per batch (Firestore allows 500). */
const BATCH_LIMIT = 500;

function addTaskCleanup(batch: WriteBatch, householdId: string, change: TaskCleanup) {
  batch.update(doc(db, "households", householdId, "tasks", change.taskId), {
    assigneeId: change.assigneeId,
    ...(change.rotation === undefined
      ? {}
      : { rotation: change.rotation === null ? deleteField() : change.rotation }),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Commits the task cleanup of a leave or removal (Phase 9 B2, B3). What fits goes into the
 * final batch, which `build` fills with the membership change; anything beyond is committed
 * first in batches of its own (while the member is still in), so the last batch stays atomic.
 */
async function commitWithCleanup(
  householdId: string,
  cleanup: TaskCleanup[],
  reserved: number,
  build: (batch: WriteBatch) => void,
): Promise<void> {
  const room = BATCH_LIMIT - reserved;
  const early = cleanup.length > room ? cleanup.slice(0, cleanup.length - room) : [];
  const late = cleanup.slice(early.length);
  for (let start = 0; start < early.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const change of early.slice(start, start + BATCH_LIMIT)) {
      addTaskCleanup(batch, householdId, change);
    }
    await batch.commit();
  }
  const batch = writeBatch(db);
  for (const change of late) addTaskCleanup(batch, householdId, change);
  build(batch);
  await batch.commit();
}

/** Household update that takes `uid` out of memberIds and the rotation order. */
function withoutMember(household: Household, uid: string) {
  return {
    memberIds: arrayRemove(uid),
    ...(rotationOrderWithout(household, uid) ? { rotationOrder: arrayRemove(uid) } : {}),
    updatedAt: serverTimestamp(),
  };
}

/**
 * «Haushalt verlassen» (HH-08, Phase 9 B1–B3, B8, B9): a member (not the owner) leaves in one
 * batch: out of memberIds and the rotation order, member doc deleted, profile householdId
 * cleared, invite count −1, «member_left», and their open tasks cleaned up (B3).
 */
export async function leaveHousehold(
  household: Household,
  me: Member,
  tasks: readonly Task[],
): Promise<void> {
  const hid = household.id;
  await commitWithCleanup(hid, memberCleanup(tasks, me.uid), 5, (batch) => {
    batch.update(doc(db, "households", hid), withoutMember(household, me.uid));
    batch.delete(doc(db, "households", hid, "members", me.uid));
    batch.update(doc(db, "users", me.uid), { householdId: null });
    batch.update(doc(db, "invites", household.inviteCode), { memberCount: increment(-1) });
    record(batch, hid, {
      actorId: me.uid,
      type: "member_left",
      targetType: "member",
      targetId: me.uid,
      targetTitle: me.displayName,
    });
  });
}

/**
 * «Aus dem Haushalt entfernen» (HH-09, Phase 9 B4): the owner removes a member like a leave,
 * except for their profile, which the removed member clears themself (B6).
 */
export async function removeMember(
  household: Household,
  ownerUid: string,
  member: Member,
  tasks: readonly Task[],
): Promise<void> {
  const hid = household.id;
  await commitWithCleanup(hid, memberCleanup(tasks, member.uid), 4, (batch) => {
    batch.update(doc(db, "households", hid), withoutMember(household, member.uid));
    batch.delete(doc(db, "households", hid, "members", member.uid));
    batch.update(doc(db, "invites", household.inviteCode), { memberCount: increment(-1) });
    record(batch, hid, {
      actorId: ownerUid,
      type: "member_removed",
      targetType: "member",
      targetId: member.uid,
      targetTitle: member.displayName,
    });
  });
}

/**
 * «Haushalt übergeben» (HH-12, Phase 9 B5): ownerId, both roles and the invite preview's
 * owner name in one batch. No activity entry.
 */
export async function handOverHousehold(
  household: Household,
  ownerUid: string,
  member: Member,
): Promise<void> {
  const hid = household.id;
  const batch = writeBatch(db);
  batch.update(doc(db, "households", hid), { ownerId: member.uid, updatedAt: serverTimestamp() });
  batch.update(doc(db, "households", hid, "members", ownerUid), { role: "member" });
  batch.update(doc(db, "households", hid, "members", member.uid), { role: "owner" });
  batch.update(doc(db, "invites", household.inviteCode), { ownerName: member.displayName });
  await batch.commit();
}

/** Deleted in this order (B7); the owner's own member doc goes in the final batch. */
const DELETE_ORDER = ["tasks", "shoppingItems", "itemStats", "events", "activity", "members"];

/** Deletes a collection in chunks of 500, read from the server, skipping `keep`. */
async function deleteCollection(householdId: string, name: string, keep?: string) {
  for (;;) {
    const snapshot = await getDocsFromServer(
      query(collection(db, "households", householdId, name), limit(BATCH_LIMIT)),
    );
    const docs = snapshot.docs.filter((d) => d.id !== keep);
    if (docs.length === 0) return;
    const batch = writeBatch(db);
    for (const d of docs) batch.delete(d.ref);
    await batch.commit();
    if (snapshot.size < BATCH_LIMIT) return;
  }
}

/**
 * «Haushalt löschen» (HH-10, Phase 9 B7), owner only. (1) `deleting` and memberIds = [owner],
 * which shuts everyone else out at once; (2) the sub-collections in chunks; (3) invite, own
 * member doc, household and own householdId in one batch. Resumable: called again on a
 * household that is already `deleting`, it skips step 1.
 */
export async function deleteHousehold(household: Household, ownerUid: string): Promise<void> {
  const hid = household.id;
  if (!household.deleting) {
    await updateDoc(doc(db, "households", hid), {
      deleting: true,
      memberIds: [ownerUid],
      ...(household.rotationOrder !== undefined ? { rotationOrder: deleteField() } : {}),
      updatedAt: serverTimestamp(),
    });
  }
  for (const name of DELETE_ORDER) {
    await deleteCollection(hid, name, name === "members" ? ownerUid : undefined);
  }
  const batch = writeBatch(db);
  batch.delete(doc(db, "invites", household.inviteCode));
  batch.delete(doc(db, "households", hid, "members", ownerUid));
  batch.delete(doc(db, "households", hid));
  batch.update(doc(db, "users", ownerUid), { householdId: null });
  await batch.commit();
}
