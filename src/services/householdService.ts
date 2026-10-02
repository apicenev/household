import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { DEFAULT_HOUSEHOLD_TIME_ZONE } from "../domain/timeZones";
import { householdConverter } from "../lib/converters/householdConverter";
import { db } from "../lib/firebase";
import type { Household, HouseholdSettingsUpdate, UserProfile } from "../types";
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
