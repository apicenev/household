import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  increment,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { cleanName, statKey } from "../domain/shopping";
import { itemStatConverter } from "../lib/converters/itemStatConverter";
import { shoppingItemConverter } from "../lib/converters/shoppingItemConverter";
import { db } from "../lib/firebase";
import type { ItemStat, NewShoppingItemInput, ShoppingItem, ShoppingItemChanges } from "../types";
import { record } from "./activityService";

/**
 * The shopping list of a household (Phase 5). Adding and checking write their activity entry
 * in the same batch (ACT-01, ACT-05, B11); a check also counts the purchase in itemStats
 * (SHP-07, B6). Every function returns the commit promise: the UI doesn't wait for it
 * (latency compensation), it only reports a rejection.
 */

/** Firestore's limit of writes per batch (SHP-06). */
export const BATCH_LIMIT = 500;

function itemsCollection(householdId: string) {
  return collection(db, "households", householdId, "shoppingItems");
}

function itemRef(householdId: string, itemId: string) {
  return doc(db, "households", householdId, "shoppingItems", itemId);
}

function statRef(householdId: string, name: string) {
  return doc(db, "households", householdId, "itemStats", statKey(name));
}

function chunks<T>(list: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < list.length; start += size) {
    result.push(list.slice(start, start + size));
  }
  return result;
}

/** Fields of a new, open item; empty quantity or notes are left out. */
function newItemData(input: NewShoppingItemInput, actorId: string) {
  return {
    name: cleanName(input.name),
    ...(input.quantity ? { quantity: input.quantity } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    category: input.category,
    checked: false,
    createdBy: actorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/** Realtime list incl. pending-write state (D44); grouping happens in domain/shopping. */
export function listenToItems(
  householdId: string,
  onChange: (items: ShoppingItem[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    itemsCollection(householdId).withConverter(shoppingItemConverter),
    { includeMetadataChanges: true },
    (snapshot) => onChange(snapshot.docs.map((d) => d.data())),
    onError,
  );
}

/** Realtime purchase history for the suggestions (B9). */
export function listenToItemStats(
  householdId: string,
  onChange: (stats: ItemStat[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, "households", householdId, "itemStats").withConverter(itemStatConverter),
    (snapshot) => onChange(snapshot.docs.map((d) => d.data())),
    onError,
  );
}

/** Adds an item and its «item_added» entry (SHP-02). The name is cleaned (B3). */
export function addItem(
  householdId: string,
  input: NewShoppingItemInput,
  actorId: string,
): { id: string; committed: Promise<void> } {
  const ref = doc(itemsCollection(householdId));
  const data = newItemData(input, actorId);
  const batch = writeBatch(db);
  batch.set(ref, data);
  record(batch, householdId, {
    actorId,
    type: "item_added",
    targetType: "item",
    targetId: ref.id,
    targetTitle: data.name,
  });
  return { id: ref.id, committed: batch.commit() };
}

/**
 * Puts a purchased item back on the list as a new item (B4): one batch deletes the checked
 * document and creates a fresh one with its quantity, notes and category, plus «item_added».
 * It's «needed again», not «wasn't bought», so itemStats stays as it is.
 */
export function readdItem(
  householdId: string,
  checkedItem: ShoppingItem,
  actorId: string,
): { id: string; committed: Promise<void> } {
  const ref = doc(itemsCollection(householdId));
  const data = newItemData(
    {
      name: checkedItem.name,
      quantity: checkedItem.quantity,
      notes: checkedItem.notes,
      category: checkedItem.category,
    },
    actorId,
  );
  const batch = writeBatch(db);
  batch.delete(itemRef(householdId, checkedItem.id));
  batch.set(ref, data);
  record(batch, householdId, {
    actorId,
    type: "item_added",
    targetType: "item",
    targetId: ref.id,
    targetTitle: data.name,
  });
  return { id: ref.id, committed: batch.commit() };
}

/** Writes only the changed fields; `null` removes quantity or notes. No activity (B11). */
export function updateItem(
  householdId: string,
  itemId: string,
  changes: ShoppingItemChanges,
): Promise<void> {
  if (Object.keys(changes).length === 0) return Promise.resolve();
  const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (changes.name !== undefined) data.name = cleanName(changes.name);
  if (changes.category !== undefined) data.category = changes.category;
  if (changes.quantity !== undefined) data.quantity = changes.quantity ?? deleteField();
  if (changes.notes !== undefined) data.notes = changes.notes ?? deleteField();
  return updateDoc(itemRef(householdId, itemId), data);
}

export function deleteItem(householdId: string, itemId: string): Promise<void> {
  return deleteDoc(itemRef(householdId, itemId));
}

/**
 * Check-off (SHP-04, B6): one batch of exactly 3 writes. The item becomes checked, itemStats
 * counts the purchase (`set` with merge, so the first purchase creates the doc) and
 * «item_purchased» is recorded.
 */
export function checkItem(householdId: string, item: ShoppingItem, actorId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(itemRef(householdId, item.id), {
    checked: true,
    checkedAt: serverTimestamp(),
    checkedBy: actorId,
    updatedAt: serverTimestamp(),
  });
  batch.set(
    statRef(householdId, item.name),
    {
      name: item.name,
      category: item.category,
      count: increment(1),
      lastPurchasedAt: serverTimestamp(),
    },
    { merge: true },
  );
  record(batch, householdId, {
    actorId,
    type: "item_purchased",
    targetType: "item",
    targetId: item.id,
    targetTitle: item.name,
  });
  return batch.commit();
}

/**
 * Uncheck («Rückgängig», «zurück auf die Liste»; B6): the item write alone, so it never fails
 * because of the stats. The purchase count then goes down by one in a separate best-effort
 * write, only when the known count is ≥ 1; a rejection (doc missing, already 0, a concurrent
 * uncheck) is ignored, it only nudges the ranking. No activity (append-only).
 */
export function uncheckItem(
  householdId: string,
  item: ShoppingItem,
  stat: ItemStat | undefined,
): Promise<void> {
  const committed = updateDoc(itemRef(householdId, item.id), {
    checked: false,
    checkedAt: deleteField(),
    checkedBy: deleteField(),
    updatedAt: serverTimestamp(),
  });
  if (stat && stat.count >= 1) {
    updateDoc(statRef(householdId, item.name), { count: increment(-1) }).catch(() => {});
  }
  return committed;
}

/**
 * «Gekaufte entfernen» (SHP-06, B7): deletes every checked item in batches of ≤ 500, sent
 * together (so they also go out offline). itemStats stays: it's the history. Returns the
 * removed items for «Rückgängig».
 */
export function clearCompleted(
  householdId: string,
  items: readonly ShoppingItem[],
): { removed: ShoppingItem[]; committed: Promise<void> } {
  const removed = items.filter((item) => item.checked);
  const commits = chunks(removed, BATCH_LIMIT).map((chunk) => {
    const batch = writeBatch(db);
    for (const item of chunk) batch.delete(itemRef(householdId, item.id));
    return batch.commit();
  });
  return { removed, committed: Promise.all(commits).then(() => undefined) };
}

/**
 * «Rückgängig» for «Gekaufte entfernen» (B7): re-creates the removed items with their ids,
 * fields and checked state; `createdAt` / `updatedAt` become the restore time.
 */
export function restoreItems(householdId: string, items: readonly ShoppingItem[]): Promise<void> {
  const commits = chunks(items, BATCH_LIMIT).map((chunk) => {
    const batch = writeBatch(db);
    for (const item of chunk) {
      batch.set(itemRef(householdId, item.id), {
        name: item.name,
        ...(item.quantity !== undefined ? { quantity: item.quantity } : {}),
        ...(item.notes !== undefined ? { notes: item.notes } : {}),
        category: item.category,
        checked: item.checked,
        ...(item.checked && item.checkedAt && item.checkedBy
          ? { checkedAt: Timestamp.fromDate(item.checkedAt), checkedBy: item.checkedBy }
          : {}),
        createdBy: item.createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return batch.commit();
  });
  return Promise.all(commits).then(() => undefined);
}
