import { createContext, useContext } from "react";
import type { ItemNameProblem } from "../../domain/shopping";
import type { ShopCategory, ShoppingItem, ShoppingItemChanges } from "../../types";

/** What adding a name did (B4, D36). */
export type AddItemResult =
  | { kind: "added"; id: string; name: string }
  | { kind: "readded"; id: string; name: string }
  | { kind: "duplicate"; item: ShoppingItem }
  | { kind: "invalid"; problem: ItemNameProblem };

export interface ShoppingActions {
  /**
   * Adds a name (SHP-02, B4, B5): refuses an open duplicate, re-adds a checked one, otherwise
   * creates the item with the category from the purchase history (or the given one).
   */
  add: (name: string, category?: ShopCategory) => AddItemResult;
  update: (item: ShoppingItem, changes: ShoppingItemChanges) => void;
  check: (item: ShoppingItem) => void;
  /** Back on the list; the purchase count goes down best-effort (B6). */
  uncheck: (item: ShoppingItem) => void;
  /** Deletes without a confirmation; the toast offers «Rückgängig» (5.8). */
  remove: (item: ShoppingItem) => void;
  /** «Gekaufte entfernen» with a «Rückgängig» toast (SHP-06, B7, D41). */
  clearCompleted: () => void;
}

export interface ShoppingContextValue {
  actions: ShoppingActions;
  /** Opens «Artikel bearbeiten» (D34): a sheet on phones, a dialog on desktop (D35). */
  openEditItem: (itemId: string) => void;
}

export const ShoppingContext = createContext<ShoppingContextValue | null>(null);

/** Shopping writes. Needs a <ShoppingProvider> (loaded household). */
export function useShopping(): ShoppingContextValue {
  const value = useContext(ShoppingContext);
  if (!value) throw new Error("useShopping() must be used inside <ShoppingProvider>.");
  return value;
}

/** Like useShopping(), but null outside a loaded household (shell error state, D8). */
export function useOptionalShopping(): ShoppingContextValue | null {
  return useContext(ShoppingContext);
}
