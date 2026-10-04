/** Shopping categories (SHP-02), in the order of the groups (Phase 5 B8). */
export type ShopCategory = "groceries" | "household" | "pharmacy" | "other";

/** households/{hid}/shoppingItems/{itemId} (SHP-01…09, Phase 5 B1). */
export interface ShoppingItem {
  id: string;
  /** 1–100 characters, cleaned on save (`cleanName`, B3). */
  name: string;
  /** 1–30 characters of free text («2», «2 l», «500 g», B2); missing without a quantity. */
  quantity?: string;
  /** 1–500 characters; missing without notes. */
  notes?: string;
  category: ShopCategory;
  /** Purchased («Gekauft», SHP-04). */
  checked: boolean;
  /** Server time of the check (checked items only). */
  checkedAt?: Date;
  /** Who checked it (checked items only). */
  checkedBy?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  /** A local write to this item hasn't reached the server yet (D44). Read model only. */
  hasPendingWrites: boolean;
}

/** What the add bar, the suggestions and the Schnellerfassung produce. */
export interface NewShoppingItemInput {
  name: string;
  quantity?: string;
  notes?: string;
  category: ShopCategory;
}

/** Fields an edit in the Artikel-Sheet changes; `null` removes quantity or notes. */
export interface ShoppingItemChanges {
  name?: string;
  quantity?: string | null;
  notes?: string | null;
  category?: ShopCategory;
}

/**
 * households/{hid}/itemStats/{key}: purchase history for the suggestions (SHP-07, B9). The
 * id is `statKey(name)`; the history survives «Gekaufte entfernen».
 */
export interface ItemStat {
  /** The doc id, `statKey(name)`. */
  key: string;
  /** The spelling of the last purchase. */
  name: string;
  /** The category of the last purchase (default category on add, B5). */
  category: ShopCategory;
  /** Number of purchases (≥ 0). */
  count: number;
  lastPurchasedAt: Date;
}
