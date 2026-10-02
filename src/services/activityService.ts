import { collection, doc, serverTimestamp, type WriteBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { NewActivityInput } from "../types";

/**
 * Adds an activity entry to an existing batch, so it's written together with the action it
 * describes (ACT-02, ACT-05). Entries are append-only (ACT-06).
 */
export function record(batch: WriteBatch, householdId: string, entry: NewActivityInput): void {
  const { details, ...rest } = entry;
  batch.set(doc(collection(db, "households", householdId, "activity")), {
    ...rest,
    ...(details !== undefined ? { details } : {}),
    createdAt: serverTimestamp(),
  });
}
