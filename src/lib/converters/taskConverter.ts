import {
  Timestamp,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
} from "firebase/firestore";
import type { Task, TaskPriority, TaskStatus } from "../../types";
import { toDate } from "./userProfileConverter";

/** Firestore shape of households/{hid}/tasks/{taskId}. */
export interface TaskDoc {
  title: string;
  notes?: string;
  assigneeId: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  completedAt?: Timestamp;
  completedBy?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * households/{hid}/tasks/{taskId} ⇄ Task (Timestamp ⇄ Date, missing ⇄ undefined). Pending
 * server times read as estimates, so «gerade eben» shows right after a completion.
 */
export const taskConverter: FirestoreDataConverter<Task, TaskDoc> = {
  toFirestore(task) {
    const t = task as Task;
    const data: TaskDoc = {
      title: t.title,
      assigneeId: t.assigneeId,
      dueDate: t.dueDate,
      priority: t.priority,
      status: t.status,
      createdBy: t.createdBy,
      createdAt: Timestamp.fromDate(t.createdAt),
      updatedAt: Timestamp.fromDate(t.updatedAt),
    };
    if (t.notes !== undefined) data.notes = t.notes;
    if (t.completedAt !== undefined) data.completedAt = Timestamp.fromDate(t.completedAt);
    if (t.completedBy !== undefined) data.completedBy = t.completedBy;
    return data;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot<DocumentData>, options?: SnapshotOptions) {
    const data = snapshot.data({ serverTimestamps: "estimate", ...options });
    return {
      id: snapshot.id,
      title: data.title,
      notes: data.notes ?? undefined,
      assigneeId: data.assigneeId ?? null,
      dueDate: data.dueDate ?? null,
      priority: data.priority as TaskPriority,
      status: data.status as TaskStatus,
      completedAt: data.completedAt ? toDate(data.completedAt) : undefined,
      completedBy: data.completedBy ?? undefined,
      createdBy: data.createdBy,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      hasPendingWrites: snapshot.metadata.hasPendingWrites,
    };
  },
};
