import {
  Timestamp,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
} from "firebase/firestore";
import type { Invite } from "../../types";
import { toDate } from "./userProfileConverter";

/** Firestore shape of invites/{code}. */
export interface InviteDoc {
  householdId: string;
  householdName: string;
  ownerName: string;
  memberCount: number;
  createdBy: string;
  createdAt: Timestamp;
}

/** invites/{code} ⇄ Invite (Timestamp ⇄ Date; the code is the document id). */
export const inviteConverter: FirestoreDataConverter<Invite, InviteDoc> = {
  toFirestore(invite) {
    const i = invite as Invite;
    return {
      householdId: i.householdId,
      householdName: i.householdName,
      ownerName: i.ownerName,
      memberCount: i.memberCount,
      createdBy: i.createdBy,
      createdAt: Timestamp.fromDate(i.createdAt),
    } satisfies InviteDoc;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot<DocumentData>, options?: SnapshotOptions) {
    const data = snapshot.data({ serverTimestamps: "estimate", ...options });
    return {
      code: snapshot.id,
      householdId: data.householdId,
      householdName: data.householdName,
      ownerName: data.ownerName,
      memberCount: data.memberCount,
      createdBy: data.createdBy,
      createdAt: toDate(data.createdAt),
    };
  },
};
