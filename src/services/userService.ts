import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { avatarColorFor, initialsFor } from "../domain/member";
import { userProfileConverter } from "../lib/converters/userProfileConverter";
import { db } from "../lib/firebase";
import type { UserProfile, UserProfileUpdate } from "../types";

function profileRef(uid: string) {
  return doc(db, "users", uid);
}

/** Longest display name the rules accept. */
const MAX_DISPLAY_NAME = 50;

/**
 * Creates users/{uid} on the first login (AUTH-05). The name is the Firebase Auth display
 * name if the account has one, otherwise the part of the email before the @.
 * Existing profiles are left untouched. The write is queued when offline, so callers
 * shouldn't block the UI on it.
 */
export async function ensureUserProfile(
  user: { uid: string; email: string },
  authDisplayName: string,
): Promise<void> {
  const ref = profileRef(user.uid);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) return;

  const displayName = (authDisplayName.trim() || user.email.split("@")[0]).slice(
    0,
    MAX_DISPLAY_NAME,
  );
  await setDoc(ref, {
    displayName,
    email: user.email,
    initials: initialsFor(displayName),
    avatarColor: avatarColorFor(user.uid),
    householdId: null,
    createdAt: serverTimestamp(),
  });
}

/**
 * Realtime profile; `onChange(null)` while the document doesn't exist yet. Also reports
 * whether the snapshot contains local writes the server hasn't confirmed yet (e.g. the
 * householdId of a pending create or join).
 */
export function listenToUserProfile(
  uid: string,
  onChange: (profile: UserProfile | null, hasPendingWrites: boolean) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    profileRef(uid).withConverter(userProfileConverter),
    { includeMetadataChanges: true },
    (snapshot) =>
      onChange(snapshot.exists() ? snapshot.data() : null, snapshot.metadata.hasPendingWrites),
    onError,
  );
}

/** Changes name, initials or avatar colour (the only fields the rules allow). */
export async function updateUserProfile(uid: string, update: UserProfileUpdate): Promise<void> {
  await updateDoc(profileRef(uid), { ...update });
}
