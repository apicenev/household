import { describe, expect, it } from "vitest";
import type { ItemStat, ShoppingItem } from "../types";
import {
  categoryFor,
  cleanName,
  findChecked,
  findOpenDuplicate,
  formatQuantity,
  frequentItems,
  groupByCategory,
  isItemWriteOutcomeReached,
  normalizeName,
  openItemCount,
  openItemKeys,
  parseQuantity,
  pendingKind,
  showAddRow,
  sortChecked,
  statKey,
  suggest,
  validateItemName,
} from "./shopping";

function item(overrides: Partial<ShoppingItem> = {}): ShoppingItem {
  return {
    id: "i1",
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

function stat(name: string, count: number, day = 1, overrides: Partial<ItemStat> = {}): ItemStat {
  return {
    key: statKey(name),
    name,
    category: "groceries",
    count,
    lastPurchasedAt: new Date(Date.UTC(2026, 8, day)),
    ...overrides,
  };
}

describe("cleanName", () => {
  it("turns every Unicode whitespace into one plain space, trims and keeps the case", () => {
    expect(cleanName("  Hafer  Milch ")).toBe("Hafer Milch");
    expect(cleanName("Hafer Milch")).toBe("Hafer Milch");
    expect(cleanName("Hafer　Milch")).toBe("Hafer Milch");
    expect(cleanName("Hafer\t\nMilch")).toBe("Hafer Milch");
    expect(cleanName("﻿Brot ")).toBe("Brot");
  });

  it("composes to NFC", () => {
    const decomposed = "Äpfel"; // «Ä» as A + combining diaeresis
    expect(cleanName(decomposed)).toBe("Äpfel");
  });
});

describe("normalizeName / statKey", () => {
  it("compares trimmed, collapsed and lowercased", () => {
    expect(normalizeName(" Milch ")).toBe("milch");
    expect(normalizeName("Hafer  Milch")).toBe("hafer milch");
    expect(normalizeName("ÄPFEL")).toBe("äpfel");
    expect(normalizeName("ÄPFEL")).toBe(normalizeName("Äpfel"));
    expect(normalizeName("Grüße")).toBe("grüße");
  });

  it("replaces «/» in the key", () => {
    expect(statKey("Milch 1/2 Fett")).toBe("milch 1∕2 fett");
  });
});

describe("validateItemName", () => {
  it("accepts names up to 100 characters after cleaning", () => {
    expect(validateItemName(" Milch ")).toBeNull();
    expect(validateItemName("x".repeat(100))).toBeNull();
    expect(validateItemName(` ${"x".repeat(100)} `)).toBeNull();
  });

  it("rejects empty, too long and reserved names", () => {
    expect(validateItemName("   ")).toBe("empty");
    expect(validateItemName("x".repeat(101))).toBe("tooLong");
    expect(validateItemName(".")).toBe("reserved");
    expect(validateItemName("..")).toBe("reserved");
    expect(validateItemName("__name__")).toBe("reserved");
    expect(validateItemName("__init")).toBeNull();
  });
});

describe("duplicates", () => {
  const items = [
    item({ id: "milk", name: "Milch" }),
    item({ id: "bread", name: "Brot", checked: true, checkedAt: new Date() }),
  ];

  it("finds an open item with the same normalised name", () => {
    expect(findOpenDuplicate(" milch ", items)?.id).toBe("milk");
    expect(findOpenDuplicate("Hafermilch", items)).toBeNull();
    expect(findOpenDuplicate("Brot", items)).toBeNull();
  });

  it("ignores the item being renamed", () => {
    expect(findOpenDuplicate("MILCH", items, "milk")).toBeNull();
  });

  it("finds a checked item for the re-add", () => {
    expect(findChecked("brot", items)?.id).toBe("bread");
    expect(findChecked("Milch", items)).toBeNull();
  });

  it("collects the open keys", () => {
    expect(openItemKeys(items)).toEqual(new Set(["milch"]));
    expect(openItemCount(items)).toBe(1);
  });
});

describe("groupByCategory / sortChecked", () => {
  it("orders groups Lebensmittel / Haushalt / Apotheke / Sonstiges and hides empty ones", () => {
    const groups = groupByCategory([
      item({ id: "bulbs", category: "other" }),
      item({ id: "tabs", category: "household" }),
      item({ id: "milk", category: "groceries" }),
      item({ id: "eggs", category: "groceries", checked: true }),
    ]);
    expect(groups.map((g) => g.category)).toEqual(["groceries", "household", "other"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["milk"]);
  });

  it("puts new items at the bottom of their group", () => {
    const [group] = groupByCategory([
      item({ id: "b", createdAt: new Date("2026-10-02T10:00:00Z") }),
      item({ id: "a", createdAt: new Date("2026-10-01T10:00:00Z") }),
      item({ id: "c", createdAt: new Date("2026-10-02T10:00:00Z") }),
    ]);
    expect(group.items.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts «Gekauft» by the latest purchase", () => {
    const sorted = sortChecked([
      item({ id: "old", checked: true, checkedAt: new Date("2026-10-01T10:00:00Z") }),
      item({ id: "open" }),
      item({ id: "new", checked: true, checkedAt: new Date("2026-10-03T10:00:00Z") }),
      item({ id: "pending", checked: true }),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(["new", "old", "pending"]);
  });
});

describe("suggest", () => {
  const stats = [
    stat("Hafermilch", 9),
    stat("Milch", 4),
    stat("Milchreis", 4, 5),
    stat("Kokosmilch", 12),
    stat("Mandelmilch", 0),
    stat("Brot", 14),
  ];

  it("ranks prefix matches first, then by count and recency", () => {
    expect(suggest("mi", stats, new Set()).map((s) => s.name)).toEqual([
      "Milchreis",
      "Milch",
      "Kokosmilch",
      "Hafermilch",
    ]);
  });

  it("excludes open items and stats with count 0, and limits the list", () => {
    const names = suggest("MILCH", stats, new Set(["milch"]), 10).map((s) => s.name);
    expect(names).toEqual(["Milchreis", "Kokosmilch", "Hafermilch"]);
    expect(suggest("milch", stats, new Set(), 2)).toHaveLength(2);
  });

  it("returns nothing for an empty query", () => {
    expect(suggest("  ", stats, new Set())).toEqual([]);
  });

  it("shows the add row unless a suggestion is exactly the input", () => {
    expect(showAddRow("mi", suggest("mi", stats, new Set()))).toBe(true);
    expect(showAddRow(" milch ", suggest("milch", stats, new Set()))).toBe(false);
    expect(showAddRow(" ", [])).toBe(false);
  });
});

describe("frequentItems", () => {
  it("returns the top items not on the list", () => {
    const stats = [
      stat("Brot", 14),
      stat("Eier", 11),
      stat("Hafermilch", 9),
      stat("Tomaten", 8),
      stat("WC-Papier", 7, 1, { category: "household" }),
      stat("Butter", 6),
      stat("Oregano", 0),
    ];
    expect(frequentItems(stats, new Set(["eier"])).map((s) => s.name)).toEqual([
      "Brot",
      "Hafermilch",
      "Tomaten",
      "WC-Papier",
      "Butter",
    ]);
    expect(frequentItems(stats, new Set(), 2).map((s) => s.name)).toEqual(["Brot", "Eier"]);
    expect(frequentItems([], new Set())).toEqual([]);
  });

  it("breaks ties by recency, then by name", () => {
    const stats = [stat("B", 3, 1), stat("A", 3, 1), stat("C", 3, 9)];
    expect(frequentItems(stats, new Set()).map((s) => s.name)).toEqual(["C", "A", "B"]);
  });
});

describe("categoryFor", () => {
  it("takes the last purchase's category, otherwise Lebensmittel", () => {
    const stats = [stat("WC-Papier", 7, 1, { category: "household" })];
    expect(categoryFor(" wc-papier ", stats)).toBe("household");
    expect(categoryFor("Glühbirnen", stats)).toBe("groceries");
  });
});

describe("quantities", () => {
  it("formats the stepper value", () => {
    expect(formatQuantity({ amount: 2, unit: "Stk." })).toBe("2");
    expect(formatQuantity({ amount: 2, unit: "l" })).toBe("2 l");
    expect(formatQuantity({ amount: 1, unit: "kg" })).toBe("1 kg");
    expect(formatQuantity({ amount: 3, unit: "Pack." })).toBe("3 Pack.");
  });

  it("parses what the stepper wrote, and nothing else", () => {
    expect(parseQuantity("2")).toEqual({ amount: 2, unit: "Stk." });
    expect(parseQuantity("2 l")).toEqual({ amount: 2, unit: "l" });
    expect(parseQuantity("12 kg")).toEqual({ amount: 12, unit: "kg" });
    expect(parseQuantity("1 Pack.")).toEqual({ amount: 1, unit: "Pack." });
    expect(parseQuantity("500 g")).toBeNull();
    expect(parseQuantity("1 Packung")).toBeNull();
    expect(parseQuantity("0")).toBeNull();
    expect(parseQuantity("1000")).toBeNull();
    expect(parseQuantity(undefined)).toBeNull();
  });

  it("round-trips", () => {
    for (const text of ["7", "2 l", "5 kg", "2 Pack."]) {
      expect(formatQuantity(parseQuantity(text)!)).toBe(text);
    }
  });
});

describe("pendingKind", () => {
  const created = new Date("2026-10-01T10:00:00Z");
  const later = new Date("2026-10-01T10:05:00Z");

  it("tells a new, a checked and another pending write apart", () => {
    expect(pendingKind(item())).toBeNull();
    expect(pendingKind(item({ hasPendingWrites: true }))).toBe("new");
    expect(pendingKind(item({ hasPendingWrites: true, checked: true, updatedAt: later }))).toBe(
      "checked",
    );
    expect(
      pendingKind(item({ hasPendingWrites: true, createdAt: created, updatedAt: later })),
    ).toBe("other");
  });
});

describe("isItemWriteOutcomeReached", () => {
  it("is silent when someone else already got there", () => {
    expect(isItemWriteOutcomeReached(item({ checked: true }), "check")).toBe(true);
    expect(isItemWriteOutcomeReached(item(), "check")).toBe(false);
    expect(isItemWriteOutcomeReached(item(), "uncheck")).toBe(true);
    expect(isItemWriteOutcomeReached(undefined, "uncheck")).toBe(false);
    expect(isItemWriteOutcomeReached(undefined, "delete")).toBe(true);
    expect(isItemWriteOutcomeReached(item(), "edit")).toBe(false);
    expect(isItemWriteOutcomeReached(undefined, "add")).toBe(false);
  });
});
