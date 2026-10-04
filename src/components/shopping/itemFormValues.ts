import {
  cleanName,
  formatQuantity,
  parseQuantity,
  QUANTITY_MAX,
  type Quantity,
  type QuantityUnit,
} from "../../domain/shopping";
import type { ShopCategory, ShoppingItem, ShoppingItemChanges } from "../../types";

/**
 * The Artikel-Sheet's state (5.8). The quantity is edited with the stepper and unit segments
 * (B2, D37); a stored quantity the stepper can't show («500 g») stays as `legacyQuantity`
 * and is only replaced once the user touches the stepper.
 */
export interface ItemFormValues {
  name: string;
  quantity: Quantity | null;
  /** A stored quantity the stepper can't represent; kept unless the stepper is touched. */
  legacyQuantity?: string;
  quantityTouched: boolean;
  category: ShopCategory;
  notes: string;
}

export function initialItemFormValues(item: ShoppingItem): ItemFormValues {
  const quantity = parseQuantity(item.quantity);
  return {
    name: item.name,
    quantity,
    legacyQuantity: quantity === null ? item.quantity : undefined,
    quantityTouched: false,
    category: item.category,
    notes: item.notes ?? "",
  };
}

/** «+»: from «–» to 1 Stk. (D37), then up to 999. */
export function stepUp(values: ItemFormValues): ItemFormValues {
  const quantity: Quantity = values.quantity
    ? { ...values.quantity, amount: Math.min(QUANTITY_MAX, values.quantity.amount + 1) }
    : { amount: 1, unit: "Stk." };
  return { ...values, quantity, quantityTouched: true };
}

/** «−»: down to 1, then back to «–» (D37); at «–» it clears a stored «500 g». */
export function stepDown(values: ItemFormValues): ItemFormValues {
  const quantity =
    values.quantity && values.quantity.amount > 1
      ? { ...values.quantity, amount: values.quantity.amount - 1 }
      : null;
  return { ...values, quantity, quantityTouched: true };
}

export function canStepDown(values: ItemFormValues): boolean {
  return values.quantity !== null || (!values.quantityTouched && !!values.legacyQuantity);
}

export function withUnit(values: ItemFormValues, unit: QuantityUnit): ItemFormValues {
  if (!values.quantity) return values;
  return { ...values, quantity: { ...values.quantity, unit }, quantityTouched: true };
}

/** The quantity text the form would save: the stepper's, or the untouched stored one. */
function quantityText(values: ItemFormValues): string | undefined {
  if (values.quantity) return formatQuantity(values.quantity);
  return values.quantityTouched ? undefined : values.legacyQuantity;
}

/** Only the fields that differ from the item; `null` removes quantity or notes. */
export function itemChanges(item: ShoppingItem, values: ItemFormValues): ShoppingItemChanges {
  const changes: ShoppingItemChanges = {};
  const name = cleanName(values.name);
  if (name !== item.name) changes.name = name;
  if (values.category !== item.category) changes.category = values.category;
  const quantity = quantityText(values);
  if (quantity !== item.quantity) changes.quantity = quantity ?? null;
  const notes = values.notes.trim() || undefined;
  if (notes !== item.notes) changes.notes = notes ?? null;
  return changes;
}
