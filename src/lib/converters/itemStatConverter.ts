import {
  Timestamp,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
} from "firebase/firestore";
import type { ItemStat, ShopCategory } from "../../types";
import { toDate } from "./userProfileConverter";

/** Firestore shape of households/{hid}/itemStats/{key} (Phase 5 B1). */
export interface ItemStatDoc {
  name: string;
  category: ShopCategory;
  count: number;
  lastPurchasedAt: Timestamp;
}

/** households/{hid}/itemStats/{key} ⇄ ItemStat (the doc id is the key). */
export const itemStatConverter: FirestoreDataConverter<ItemStat, ItemStatDoc> = {
  toFirestore(stat) {
    const s = stat as ItemStat;
    return {
      name: s.name,
      category: s.category,
      count: s.count,
      lastPurchasedAt: Timestamp.fromDate(s.lastPurchasedAt),
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot<DocumentData>, options?: SnapshotOptions) {
    const data = snapshot.data({ serverTimestamps: "estimate", ...options });
    return {
      key: snapshot.id,
      name: data.name,
      category: data.category as ShopCategory,
      count: typeof data.count === "number" ? data.count : 0,
      lastPurchasedAt: toDate(data.lastPurchasedAt),
    };
  },
};
