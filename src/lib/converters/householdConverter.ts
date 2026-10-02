import {
  Timestamp,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
} from "firebase/firestore";
import type { Household, WeekStart } from "../../types";
import { toDate } from "./userProfileConverter";

/** Firestore shape of households/{hid}. */
export interface HouseholdDoc {
  name: string;
  ownerId: string;
  memberIds: string[];
  weekStartsOn: number;
  timeZone: string;
  inviteCode: string;
  inviteCreatedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** households/{hid} ⇄ Household (Timestamp ⇄ Date). */
export const householdConverter: FirestoreDataConverter<Household, HouseholdDoc> = {
  toFirestore(household) {
    const h = household as Household;
    return {
      name: h.name,
      ownerId: h.ownerId,
      memberIds: h.memberIds,
      weekStartsOn: h.weekStartsOn,
      timeZone: h.timeZone,
      inviteCode: h.inviteCode,
      inviteCreatedAt: Timestamp.fromDate(h.inviteCreatedAt),
      createdAt: Timestamp.fromDate(h.createdAt),
      updatedAt: Timestamp.fromDate(h.updatedAt),
    } satisfies HouseholdDoc;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot<DocumentData>, options?: SnapshotOptions) {
    const data = snapshot.data({ serverTimestamps: "estimate", ...options });
    return {
      id: snapshot.id,
      name: data.name,
      ownerId: data.ownerId,
      memberIds: data.memberIds ?? [],
      weekStartsOn: data.weekStartsOn as WeekStart,
      timeZone: data.timeZone,
      inviteCode: data.inviteCode,
      inviteCreatedAt: toDate(data.inviteCreatedAt),
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    };
  },
};
