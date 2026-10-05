import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  where,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Unsubscribe,
  type WriteBatch,
} from "firebase/firestore";
import { ACTIVITY_PAGE_SIZE } from "../domain/activity";
import { activityConverter, type ActivityDoc } from "../lib/converters/activityConverter";
import { db } from "../lib/firebase";
import type { ActivityEntry, ActivityTargetType, NewActivityInput } from "../types";

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

/** Where the next older page starts (B2). */
export type ActivityCursor = QueryDocumentSnapshot<ActivityEntry, ActivityDoc>;

/** An entry with its own snapshot, so any entry can be the cursor of «Mehr laden». */
export interface FeedItem {
  entry: ActivityEntry;
  cursor: ActivityCursor;
}

/**
 * Newest first, optionally of one target type (ACT-08, B3). The filtered query needs the
 * composite index `activity (targetType ASC, createdAt DESC)` in firestore.indexes.json.
 */
function feedQuery(householdId: string, targetType: ActivityTargetType | undefined) {
  const constraints: QueryConstraint[] = [
    ...(targetType ? [where("targetType", "==", targetType)] : []),
    orderBy("createdAt", "desc"),
  ];
  return query(
    collection(db, "households", householdId, "activity").withConverter(activityConverter),
    ...constraints,
  );
}

const toItems = (docs: ActivityCursor[]): FeedItem[] =>
  docs.map((cursor) => ({ entry: cursor.data(), cursor }));

/** The live first page: the latest 50 entries (ACT-04, B2). */
export function listenToActivity(
  householdId: string,
  targetType: ActivityTargetType | undefined,
  onChange: (items: FeedItem[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(feedQuery(householdId, targetType), limit(ACTIVITY_PAGE_SIZE)),
    (snapshot) => onChange(toItems(snapshot.docs)),
    onError,
  );
}

/**
 * «Mehr laden» (B2): the 50 entries after `after`, read once (entries never change). Fewer
 * than 50 means there are no older ones.
 */
export async function loadOlderActivity(
  householdId: string,
  targetType: ActivityTargetType | undefined,
  after: ActivityCursor,
): Promise<FeedItem[]> {
  const snapshot = await getDocs(
    query(feedQuery(householdId, targetType), startAfter(after), limit(ACTIVITY_PAGE_SIZE)),
  );
  return toItems(snapshot.docs);
}
