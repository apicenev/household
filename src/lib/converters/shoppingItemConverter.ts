import {
  Timestamp,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
} from "firebase/firestore";
import type { ShopCategory, ShoppingItem } from "../../types";
import { toDate } from "./userProfileConverter";

/** Firestore shape of households/{hid}/shoppingItems/{itemId} (Phase 5 B1). */
export interface ShoppingItemDoc {
  name: string;
  quantity?: string;
  notes?: string;
  category: ShopCategory;
  checked: boolean;
  checkedAt?: Timestamp;
  checkedBy?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * households/{hid}/shoppingItems/{itemId} ⇄ ShoppingItem (Timestamp ⇄ Date, missing ⇄
 * undefined). Pending server times read as estimates, so a fresh check sorts first in
 * «Gekauft».
 */
export const shoppingItemConverter: FirestoreDataConverter<ShoppingItem, ShoppingItemDoc> = {
  toFirestore(item) {
    const i = item as ShoppingItem;
    const data: ShoppingItemDoc = {
      name: i.name,
      category: i.category,
      checked: i.checked,
      createdBy: i.createdBy,
      createdAt: Timestamp.fromDate(i.createdAt),
      updatedAt: Timestamp.fromDate(i.updatedAt),
    };
    if (i.quantity !== undefined) data.quantity = i.quantity;
    if (i.notes !== undefined) data.notes = i.notes;
    if (i.checkedAt !== undefined) data.checkedAt = Timestamp.fromDate(i.checkedAt);
    if (i.checkedBy !== undefined) data.checkedBy = i.checkedBy;
    return data;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot<DocumentData>, options?: SnapshotOptions) {
    const data = snapshot.data({ serverTimestamps: "estimate", ...options });
    return {
      id: snapshot.id,
      name: data.name,
      quantity: data.quantity ?? undefined,
      notes: data.notes ?? undefined,
      category: data.category as ShopCategory,
      checked: data.checked === true,
      checkedAt: data.checkedAt ? toDate(data.checkedAt) : undefined,
      checkedBy: data.checkedBy ?? undefined,
      createdBy: data.createdBy,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      hasPendingWrites: snapshot.metadata.hasPendingWrites,
    };
  },
};
