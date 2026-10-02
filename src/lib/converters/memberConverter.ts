import {
  Timestamp,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
} from "firebase/firestore";
import type { AvatarColor, Member, MemberRole } from "../../types";
import { toDate } from "./userProfileConverter";

/** Firestore shape of households/{hid}/members/{uid}. */
export interface MemberDoc {
  displayName: string;
  initials: string;
  avatarColor: number;
  role: MemberRole;
  joinedAt: Timestamp;
  joinedWithCode?: string;
}

/** households/{hid}/members/{uid} ⇄ Member (Timestamp ⇄ Date, missing ⇄ undefined). */
export const memberConverter: FirestoreDataConverter<Member, MemberDoc> = {
  toFirestore(member) {
    const m = member as Member;
    const data: MemberDoc = {
      displayName: m.displayName,
      initials: m.initials,
      avatarColor: m.avatarColor,
      role: m.role,
      joinedAt: Timestamp.fromDate(m.joinedAt),
    };
    if (m.joinedWithCode !== undefined) data.joinedWithCode = m.joinedWithCode;
    return data;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot<DocumentData>, options?: SnapshotOptions) {
    const data = snapshot.data({ serverTimestamps: "estimate", ...options });
    return {
      uid: snapshot.id,
      displayName: data.displayName,
      initials: data.initials,
      avatarColor: data.avatarColor as AvatarColor,
      role: data.role as MemberRole,
      joinedAt: toDate(data.joinedAt),
      joinedWithCode: data.joinedWithCode ?? undefined,
    };
  },
};
