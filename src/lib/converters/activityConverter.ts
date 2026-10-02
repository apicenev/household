import {
  Timestamp,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
} from "firebase/firestore";
import type { ActivityEntry, ActivityTargetType, ActivityType } from "../../types";
import { toDate } from "./userProfileConverter";

/** Firestore shape of households/{hid}/activity/{id}. */
export interface ActivityDoc {
  actorId: string;
  type: ActivityType;
  targetType: ActivityTargetType;
  targetId: string;
  targetTitle: string;
  details?: ActivityEntry["details"];
  createdAt: Timestamp;
}

/** households/{hid}/activity/{id} ⇄ ActivityEntry (Timestamp ⇄ Date, missing ⇄ undefined). */
export const activityConverter: FirestoreDataConverter<ActivityEntry, ActivityDoc> = {
  toFirestore(entry) {
    const e = entry as ActivityEntry;
    const data: ActivityDoc = {
      actorId: e.actorId,
      type: e.type,
      targetType: e.targetType,
      targetId: e.targetId,
      targetTitle: e.targetTitle,
      createdAt: Timestamp.fromDate(e.createdAt),
    };
    if (e.details !== undefined) data.details = e.details;
    return data;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot<DocumentData>, options?: SnapshotOptions) {
    const data = snapshot.data({ serverTimestamps: "estimate", ...options });
    return {
      id: snapshot.id,
      actorId: data.actorId,
      type: data.type as ActivityType,
      targetType: data.targetType as ActivityTargetType,
      targetId: data.targetId,
      targetTitle: data.targetTitle,
      details: data.details ?? undefined,
      createdAt: toDate(data.createdAt),
    };
  },
};
