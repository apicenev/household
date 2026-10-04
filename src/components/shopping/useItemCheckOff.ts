import { ArrowUturnLeftIcon } from "@heroicons/react/16/solid";
import { useCallback, useEffect, useRef } from "react";
import { useDelayedCheck } from "../../hooks/useDelayedCheck";
import { actions as actionLabels, shoppingCopy } from "../../lib/copy";
import type { ShoppingItem } from "../../types";
import { useToast } from "../ui/toastContext";
import type { ShoppingActions } from "./shoppingContext";

/** How long the «gekauft» toast with «Rückgängig» stays (as the prototype, B6). */
export const PURCHASED_TOAST_MS = 5000;

/**
 * Shopping check-off (SHP-04, UI-06, B6) on top of `useDelayedCheck`: after the 700 ms window
 * the check is written and ««Milch» gekauft» offers «Rückgängig». One toast at a time.
 */
export function useItemCheckOff(items: ShoppingItem[], actions: ShoppingActions) {
  const toast = useToast();
  const toastId = useRef<string | null>(null);

  const latest = useRef({ items, actions, toast });
  useEffect(() => {
    latest.current = { items, actions, toast };
  });

  const finish = useCallback((itemId: string) => {
    const { items: current, actions: write, toast: toasts } = latest.current;
    const item = current.find((candidate) => candidate.id === itemId);
    // Checked or deleted by someone else meanwhile: nothing to do.
    if (!item || item.checked) return;
    write.check(item);
    if (toastId.current) toasts.dismiss(toastId.current);
    toastId.current = toasts.show({
      message: shoppingCopy.purchasedToast(item.name),
      duration: PURCHASED_TOAST_MS,
      action: {
        label: actionLabels.undo,
        icon: ArrowUturnLeftIcon,
        onClick: () => latest.current.actions.uncheck({ ...item, checked: true }),
      },
    });
  }, []);

  return useDelayedCheck(finish);
}
