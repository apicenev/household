import { ArrowUturnLeftIcon } from "@heroicons/react/16/solid";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  categoryFor,
  cleanName,
  findChecked,
  findOpenDuplicate,
  isItemWriteOutcomeReached,
  statKey,
  validateItemName,
  type ItemWriteIntent,
} from "../../domain/shopping";
import { useAuth } from "../../lib/auth/useAuth";
import { actions as actionLabels, shoppingCopy } from "../../lib/copy";
import { GENERIC_WRITE_ERROR } from "../../lib/firestoreErrors";
import { useLoadedHousehold } from "../../lib/household/useHousehold";
import {
  addItem,
  checkItem,
  clearCompleted,
  deleteItem,
  readdItem,
  restoreItems,
  uncheckItem,
  updateItem,
} from "../../services/shoppingService";
import type { ShopCategory, ShoppingItem, ShoppingItemChanges } from "../../types";
import { useToast } from "../ui/toastContext";
import type { AddItemResult, ShoppingActions } from "./shoppingContext";

/** How long a rejection waits before it looks at the item (as Phase 3 D21). */
export const REJECTION_SETTLE_MS = 300;
/** «Gekaufte entfernen» toast with «Rückgängig» (D41). */
export const CLEARED_TOAST_MS = 5000;

/**
 * Shopping writes for the UI (one instance, in ShoppingProvider). They don't wait for the
 * server: the listeners show the change at once, only a rejection is reported, and it stays
 * silent when the item already is where the write wanted it (D21 pattern).
 */
export function useShoppingWriter(): ShoppingActions {
  const { household, items, itemStats } = useLoadedHousehold();
  const { user } = useAuth();
  const toast = useToast();
  const uid = user?.uid ?? "";
  const householdId = household.id;

  // The latest state: duplicate checks at the moment of the tap, and rejections that arrive
  // long after the call (offline queue).
  const latest = useRef({ items, itemStats });
  useEffect(() => {
    latest.current = { items, itemStats };
  }, [items, itemStats]);

  const watch = useCallback(
    (promise: Promise<void>, itemId: string, intent: ItemWriteIntent) => {
      promise.catch(() => {
        window.setTimeout(() => {
          const current = latest.current.items.find((item) => item.id === itemId);
          if (isItemWriteOutcomeReached(current, intent)) return;
          if (!current && (intent === "edit" || intent === "check")) {
            toast.show({ message: shoppingCopy.deletedElsewhere, tone: "info" });
            return;
          }
          toast.show({ message: GENERIC_WRITE_ERROR, tone: "error" });
        }, REJECTION_SETTLE_MS);
      });
    },
    [toast],
  );

  return useMemo<ShoppingActions>(() => {
    const restore = (removed: ShoppingItem[]) => {
      restoreItems(householdId, removed).catch(() =>
        toast.show({ message: GENERIC_WRITE_ERROR, tone: "error" }),
      );
    };

    return {
      add(name: string, category?: ShopCategory): AddItemResult {
        const problem = validateItemName(name);
        if (problem) return { kind: "invalid", problem };
        const { items: current, itemStats: stats } = latest.current;
        const duplicate = findOpenDuplicate(name, current);
        if (duplicate) return { kind: "duplicate", item: duplicate };
        const bought = findChecked(name, current);
        if (bought) {
          const { id, committed } = readdItem(householdId, bought, uid);
          watch(committed, id, "add");
          return { kind: "readded", id, name: bought.name };
        }
        const cleaned = cleanName(name);
        const { id, committed } = addItem(
          householdId,
          { name: cleaned, category: category ?? categoryFor(cleaned, stats) },
          uid,
        );
        watch(committed, id, "add");
        return { kind: "added", id, name: cleaned };
      },
      update(item: ShoppingItem, changes: ShoppingItemChanges) {
        watch(updateItem(householdId, item.id, changes), item.id, "edit");
      },
      check(item: ShoppingItem) {
        watch(checkItem(householdId, item, uid), item.id, "check");
      },
      uncheck(item: ShoppingItem) {
        const key = statKey(item.name);
        const stat = latest.current.itemStats.find((candidate) => candidate.key === key);
        watch(uncheckItem(householdId, item, stat), item.id, "uncheck");
      },
      remove(item: ShoppingItem) {
        watch(deleteItem(householdId, item.id), item.id, "delete");
        toast.show({
          message: shoppingCopy.deletedToast(item.name),
          duration: CLEARED_TOAST_MS,
          action: {
            label: actionLabels.undo,
            icon: ArrowUturnLeftIcon,
            // An open item is re-created as one's own (the rules want createdBy == the
            // writer for open items); a checked one is restored as it was (B7).
            onClick: () => restore([item.checked ? item : { ...item, createdBy: uid }]),
          },
        });
      },
      clearCompleted() {
        const { removed, committed } = clearCompleted(householdId, latest.current.items);
        if (removed.length === 0) return;
        committed.catch(() => toast.show({ message: GENERIC_WRITE_ERROR, tone: "error" }));
        toast.show({
          message: shoppingCopy.clearedToast(removed.length),
          duration: CLEARED_TOAST_MS,
          action: {
            label: actionLabels.undo,
            icon: ArrowUturnLeftIcon,
            onClick: () => restore(removed),
          },
        });
      },
    };
  }, [householdId, uid, watch, toast]);
}
