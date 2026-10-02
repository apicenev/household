import {
  Timestamp,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
} from "firebase/firestore";
import type { AvatarColor, UserProfile } from "../../types";

/** Firestore shape of users/{uid}. */
export interface UserProfileDoc {
  displayName: string;
  email: string;
  initials: string;
  avatarColor: number;
  householdId: string | null;
  createdAt: Timestamp;
}

/** Timestamp → Date; a pending server timestamp (null) becomes "now". */
export function toDate(value: unknown): Date {
  return value instanceof Timestamp ? value.toDate() : new Date();
}

/** users/{uid} ⇄ UserProfile (Timestamp ⇄ Date, null ⇄ undefined). */
export const userProfileConverter: FirestoreDataConverter<UserProfile, UserProfileDoc> = {
  toFirestore(profile) {
    const { displayName, email, initials, avatarColor, householdId, createdAt } =
      profile as UserProfile;
    return {
      displayName,
      email,
      initials,
      avatarColor,
      householdId: householdId ?? null,
      createdAt: Timestamp.fromDate(createdAt),
    } satisfies UserProfileDoc;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot<DocumentData>, options?: SnapshotOptions) {
    const data = snapshot.data({ serverTimestamps: "estimate", ...options });
    return {
      uid: snapshot.id,
      displayName: data.displayName,
      email: data.email,
      initials: data.initials,
      avatarColor: data.avatarColor as AvatarColor,
      householdId: data.householdId ?? undefined,
      createdAt: toDate(data.createdAt),
    };
  },
};
