import { describe, expect, it } from "vitest";
import type { ShoppingItem } from "../../types";
import {
  canStepDown,
  initialItemFormValues,
  itemChanges,
  stepDown,
  stepUp,
  withUnit,
} from "./itemFormValues";

function item(overrides: Partial<ShoppingItem> = {}): ShoppingItem {
  return {
    id: "milk",
    name: "Milch",
    category: "groceries",
    checked: false,
    createdBy: "nevio",
    createdAt: new Date("2026-10-01T10:00:00Z"),
    updatedAt: new Date("2026-10-01T10:00:00Z"),
    hasPendingWrites: false,
    ...overrides,
  };
}

describe("initialItemFormValues", () => {
  it("reads a stepper quantity", () => {
    const values = initialItemFormValues(item({ quantity: "2 l", notes: "Bio" }));
    expect(values).toMatchObject({
      name: "Milch",
      quantity: { amount: 2, unit: "l" },
      legacyQuantity: undefined,
      notes: "Bio",
    });
  });

  it("keeps a quantity the stepper can't show as legacy (B2)", () => {
    const values = initialItemFormValues(item({ quantity: "500 g" }));
    expect(values.quantity).toBeNull();
    expect(values.legacyQuantity).toBe("500 g");
  });
});

describe("stepper (D37)", () => {
  it("goes from «–» to 1 Stk., up, and back to «–»", () => {
    let values = initialItemFormValues(item());
    expect(canStepDown(values)).toBe(false);
    values = stepUp(values);
    expect(values.quantity).toEqual({ amount: 1, unit: "Stk." });
    values = withUnit(stepUp(values), "l");
    expect(values.quantity).toEqual({ amount: 2, unit: "l" });
    values = stepDown(stepDown(values));
    expect(values.quantity).toBeNull();
    expect(canStepDown(values)).toBe(false);
  });

  it("stops at 999", () => {
    let values = initialItemFormValues(item({ quantity: "999" }));
    values = stepUp(values);
    expect(values.quantity?.amount).toBe(999);
  });

  it("ignores a unit while empty", () => {
    const values = initialItemFormValues(item());
    expect(withUnit(values, "kg")).toBe(values);
  });

  it("clears a legacy quantity with «−», or replaces it with «+»", () => {
    const values = initialItemFormValues(item({ quantity: "500 g" }));
    expect(canStepDown(values)).toBe(true);
    expect(itemChanges(item({ quantity: "500 g" }), stepDown(values))).toEqual({ quantity: null });
    expect(itemChanges(item({ quantity: "500 g" }), stepUp(values))).toEqual({ quantity: "1" });
  });
});

describe("itemChanges", () => {
  it("is empty without changes, also for an untouched legacy quantity", () => {
    expect(itemChanges(item(), initialItemFormValues(item()))).toEqual({});
    const legacy = item({ quantity: "500 g", notes: "Bio" });
    expect(itemChanges(legacy, initialItemFormValues(legacy))).toEqual({});
  });

  it("returns the changed fields, cleaned, with null for removed ones", () => {
    const original = item({ quantity: "2 l", notes: "Bio" });
    const values = {
      ...stepDown(stepDown(initialItemFormValues(original))),
      name: " Hafer  Milch ",
      category: "other" as const,
      notes: "  ",
    };
    expect(itemChanges(original, values)).toEqual({
      name: "Hafer Milch",
      category: "other",
      quantity: null,
      notes: null,
    });
  });

  it("adds a quantity and notes", () => {
    const values = { ...stepUp(initialItemFormValues(item())), notes: " Laktosefrei " };
    expect(itemChanges(item(), values)).toEqual({ quantity: "1", notes: "Laktosefrei" });
  });
});
