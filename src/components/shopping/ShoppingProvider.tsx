import { TrashIcon } from "@heroicons/react/20/solid";
import { TrashIcon as TrashOutline } from "@heroicons/react/24/outline";
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { findOpenDuplicate, validateItemName } from "../../domain/shopping";
import { useIsDesktop } from "../../hooks/useMediaQuery";
import { actions as actionLabels, shoppingCopy } from "../../lib/copy";
import { useLoadedHousehold } from "../../lib/household/useHousehold";
import type { ShoppingItem } from "../../types";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/toastContext";
import { ItemForm } from "./ItemForm";
import { initialItemFormValues, itemChanges, type ItemFormValues } from "./itemFormValues";
import { ShoppingContext, useShopping, type ShoppingContextValue } from "./shoppingContext";
import { useShoppingWriter } from "./useShoppingWriter";

/**
 * Shopping writes plus the one shared «Artikel bearbeiten» sheet (5.8) for the whole shell of
 * a loaded household, so the Einkauf page and the Schnellerfassung share them (like
 * TaskProvider).
 */
export function ShoppingProvider({ children }: { children: ReactNode }) {
  const actions = useShoppingWriter();
  const [editId, setEditId] = useState<string | null>(null);
  // Bumped on every open, so the form starts from fresh values.
  const [sheetKey, setSheetKey] = useState(0);

  const openEditItem = useCallback((itemId: string) => {
    setEditId(itemId);
    setSheetKey((key) => key + 1);
  }, []);
  const close = useCallback(() => setEditId(null), []);

  const value = useMemo<ShoppingContextValue>(
    () => ({ actions, openEditItem }),
    [actions, openEditItem],
  );

  return (
    <ShoppingContext.Provider value={value}>
      {children}
      <ItemSheet key={sheetKey} editId={editId} onClose={close} />
    </ShoppingContext.Provider>
  );
}

/**
 * The Artikel-Sheet (phones) / a 560 px dialog (desktop, D35). Saves only changed fields and
 * closes at once; closes with a toast when the item is deleted by someone else (D40).
 */
function ItemSheet({ editId, onClose }: { editId: string | null; onClose: () => void }) {
  const { items } = useLoadedHousehold();
  const { actions } = useShopping();
  const toast = useToast();
  const desktop = useIsDesktop();
  const formId = useId();

  const item = editId ? items.find((candidate) => candidate.id === editId) : undefined;
  // The item as it was when the sheet opened: the base for «only changed fields».
  const [original] = useState<ShoppingItem | undefined>(item);
  const [values, setValues] = useState<ItemFormValues | null>(() =>
    item ? initialItemFormValues(item) : null,
  );
  const [nameError, setNameError] = useState<string | undefined>();

  const vanished = editId !== null && !item;
  useEffect(() => {
    if (!vanished) return;
    toast.show({ message: shoppingCopy.deletedElsewhere, tone: "info" });
    onClose();
  }, [vanished, toast, onClose]);

  function change(next: ItemFormValues) {
    setValues(next);
    if (next.name !== values?.name) setNameError(undefined);
  }

  const changes = original && values ? itemChanges(original, values) : {};
  const canSave = Object.keys(changes).length > 0 && values?.name.trim() !== "";

  function submit() {
    if (!item || !values) return;
    const problem = validateItemName(values.name);
    if (problem) {
      setNameError(
        problem === "empty"
          ? shoppingCopy.nameEmpty
          : problem === "tooLong"
            ? shoppingCopy.nameTooLong
            : shoppingCopy.nameReserved,
      );
      return;
    }
    if (findOpenDuplicate(values.name, items, item.id)) {
      setNameError(shoppingCopy.nameDuplicate);
      return;
    }
    if (Object.keys(changes).length > 0) actions.update(item, changes);
    onClose();
  }

  function remove() {
    if (!item) return;
    // Close first, so the «deleted elsewhere» check doesn't fire (D40).
    onClose();
    actions.remove(item);
  }

  return (
    <Sheet
      open={editId !== null && !vanished && values !== null}
      onClose={onClose}
      title={shoppingCopy.editItem}
      size="md"
      footer={
        desktop ? (
          <>
            <Button
              variant="danger-ghost"
              size="compact"
              icon={TrashIcon}
              onClick={remove}
              className="mr-auto"
            >
              {shoppingCopy.deleteItem}
            </Button>
            <Button variant="secondary" size="compact" onClick={onClose}>
              {actionLabels.cancel}
            </Button>
            <Button type="submit" form={formId} size="compact" disabled={!canSave}>
              {actionLabels.save}
            </Button>
          </>
        ) : (
          <div className="flex w-full gap-2">
            <button
              type="button"
              aria-label={shoppingCopy.deleteItem}
              onClick={remove}
              className="flex size-13 shrink-0 cursor-pointer items-center justify-center rounded-control bg-surface text-danger inset-ring inset-ring-line-strong hovered:bg-danger-soft"
            >
              <TrashOutline aria-hidden="true" className="size-6" />
            </button>
            <Button type="submit" form={formId} size="lg" disabled={!canSave} className="flex-1">
              {actionLabels.save}
            </Button>
          </div>
        )
      }
    >
      {values && (
        <ItemForm
          formId={formId}
          values={values}
          onChange={change}
          nameError={nameError}
          onSubmit={submit}
        />
      )}
    </Sheet>
  );
}
