import { collection, doc, onSnapshot, writeBatch, type Unsubscribe } from "firebase/firestore";
import { initialsFor } from "../domain/member";
import { memberConverter } from "../lib/converters/memberConverter";
import { db } from "../lib/firebase";
import type { Household, Member, MyProfileUpdate, UserProfile } from "../types";

/** Realtime member list of a household (unsorted; see sortMembers). */
export function listenToMembers(
  householdId: string,
  onChange: (members: Member[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, "households", householdId, "members").withConverter(memberConverter),
    (snapshot) => onChange(snapshot.docs.map((d) => d.data())),
    onError,
  );
}

/**
 * Changes the own name or avatar colour (HH-05) in one batch: profile, member doc and, for
 * the owner, the invite preview's ownerName. Initials follow the name. The member doc gets
 * all three fields, so it's back in sync with the profile even if it had drifted.
 */
export async function updateMyProfile(
  profile: UserProfile,
  household: Household,
  update: MyProfileUpdate,
): Promise<void> {
  const displayName = update.displayName ?? profile.displayName;
  const next = {
    displayName,
    initials: update.displayName !== undefined ? initialsFor(displayName) : profile.initials,
    avatarColor: update.avatarColor ?? profile.avatarColor,
  };
  const batch = writeBatch(db);
  batch.update(doc(db, "users", profile.uid), next);
  batch.update(doc(db, "households", household.id, "members", profile.uid), next);
  if (household.ownerId === profile.uid && displayName !== profile.displayName) {
    batch.update(doc(db, "invites", household.inviteCode), { ownerName: displayName });
  }
  await batch.commit();
}
