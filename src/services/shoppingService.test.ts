import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemStat, ShoppingItem } from "../types";

// In-memory stand-in for the Firestore calls shoppingService makes: batches and single writes
// record their operations.
type Op = { op: string; path: string; data?: unknown; options?: unknown };
const fake = vi.hoisted(() => {
  const state = {
    commits: [] as Op[][],
    writes: [] as Op[],
    autoId: 0,
    /** Paths whose single update is rejected. */
    rejectPaths: new Set<string>(),
  };
  return { state };
});

vi.mock("../lib/firebase", () => ({ db: {} }));

vi.mock("firebase/firestore", () => {
  const { state } = fake;
  type Parent = { kind?: string; path?: string };
  const ref = (path: string) => ({ path, id: path.split("/").pop() ?? "" });
  return {
    Timestamp: { fromDate: (date: Date) => `TS(${date.toISOString()})` },
    collection: (_db: unknown, ...segments: string[]) => ({
      kind: "collection",
      path: segments.join("/"),
      withConverter() {
        return this;
      },
    }),
    doc: (parent: Parent, ...segments: string[]) =>
      parent?.kind === "collection"
        ? ref(`${parent.path}/${segments[0] ?? `auto${++state.autoId}`}`)
        : ref(segments.join("/")),
    writeBatch: () => {
      const ops: Op[] = [];
      return {
        set: (r: { path: string }, data: unknown, options?: unknown) =>
          ops.push({ op: "set", path: r.path, data, ...(options ? { options } : {}) }),
        update: (r: { path: string }, data: unknown) =>
          ops.push({ op: "update", path: r.path, data }),
        delete: (r: { path: string }) => ops.push({ op: "delete", path: r.path }),
        commit: async () => {
          state.commits.push(ops);
        },
      };
    },
    updateDoc: async (r: { path: string }, data: unknown) => {
      state.writes.push({ op: "update", path: r.path, data });
      if (state.rejectPaths.has(r.path)) throw new Error("permission-denied");
    },
    deleteDoc: async (r: { path: string }) => {
      state.writes.push({ op: "delete", path: r.path });
    },
    increment: (n: number) => `INCREMENT(${n})`,
    serverTimestamp: () => "SERVER_TIME",
    deleteField: () => "DELETE_FIELD",
    onSnapshot: vi.fn(),
  };
});

const {
  addItem,
  checkItem,
  clearCompleted,
  deleteItem,
  readdItem,
  restoreItems,
  uncheckItem,
  updateItem,
} = await import("./shoppingService");

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

const checked = (overrides: Partial<ShoppingItem> = {}) =>
  item({
    checked: true,
    checkedAt: new Date("2026-10-02T10:00:00Z"),
    checkedBy: "anna",
    ...overrides,
  });

function stat(count: number): ItemStat {
  return {
    key: "milch",
    name: "Milch",
    category: "groceries",
    count,
    lastPurchasedAt: new Date("2026-10-02T10:00:00Z"),
  };
}

const activity = (type: string, targetId: string, targetTitle = "Milch") => ({
  op: "set",
  path: "households/h1/activity/autoX",
  data: {
    actorId: "nevio",
    type,
    targetType: "item",
    targetId,
    targetTitle,
    createdAt: "SERVER_TIME",
  },
});

/** Activity paths get an auto id; compare them without it. */
function withoutAutoIds(ops: Op[]) {
  return ops.map((op) =>
    op.path.startsWith("households/h1/activity/")
      ? { ...op, path: "households/h1/activity/autoX" }
      : op,
  );
}

beforeEach(() => {
  fake.state.commits = [];
  fake.state.writes = [];
  fake.state.autoId = 0;
  fake.state.rejectPaths = new Set();
});

describe("addItem", () => {
  it("writes the cleaned item and «item_added» in one batch", async () => {
    const { id, committed } = addItem(
      "h1",
      { name: " Hafer  Milch ", quantity: "2 l", category: "groceries" },
      "nevio",
    );
    await committed;
    expect(id).toBe("auto1");
    expect(withoutAutoIds(fake.state.commits[0])).toEqual([
      {
        op: "set",
        path: "households/h1/shoppingItems/auto1",
        data: {
          name: "Hafer Milch",
          quantity: "2 l",
          category: "groceries",
          checked: false,
          createdBy: "nevio",
          createdAt: "SERVER_TIME",
          updatedAt: "SERVER_TIME",
        },
      },
      activity("item_added", "auto1", "Hafer Milch"),
    ]);
  });

  it("leaves out empty quantity and notes", async () => {
    await addItem("h1", { name: "Brot", quantity: "", notes: "", category: "groceries" }, "nevio")
      .committed;
    const data = fake.state.commits[0][0].data as Record<string, unknown>;
    expect(Object.keys(data)).not.toContain("quantity");
    expect(Object.keys(data)).not.toContain("notes");
  });
});

describe("readdItem", () => {
  it("deletes the checked item and creates a fresh copy with «item_added», no stats", async () => {
    const old = checked({ id: "old", quantity: "2 l", notes: "Bio", category: "other" });
    const { id, committed } = readdItem("h1", old, "nevio");
    await committed;
    expect(id).toBe("auto1");
    expect(withoutAutoIds(fake.state.commits[0])).toEqual([
      { op: "delete", path: "households/h1/shoppingItems/old" },
      {
        op: "set",
        path: "households/h1/shoppingItems/auto1",
        data: {
          name: "Milch",
          quantity: "2 l",
          notes: "Bio",
          category: "other",
          checked: false,
          createdBy: "nevio",
          createdAt: "SERVER_TIME",
          updatedAt: "SERVER_TIME",
        },
      },
      activity("item_added", "auto1"),
    ]);
    expect(fake.state.commits[0].some((op) => op.path.includes("itemStats"))).toBe(false);
  });
});

describe("updateItem / deleteItem", () => {
  it("writes only the changed fields and removes cleared optionals", async () => {
    await updateItem("h1", "i1", {
      name: " Brot ",
      quantity: null,
      notes: "Ruch",
      category: "other",
    });
    expect(fake.state.writes).toEqual([
      {
        op: "update",
        path: "households/h1/shoppingItems/i1",
        data: {
          updatedAt: "SERVER_TIME",
          name: "Brot",
          category: "other",
          quantity: "DELETE_FIELD",
          notes: "Ruch",
        },
      },
    ]);
  });

  it("writes nothing without changes", async () => {
    await updateItem("h1", "i1", {});
    expect(fake.state.writes).toEqual([]);
  });

  it("deletes the item", async () => {
    await deleteItem("h1", "i1");
    expect(fake.state.writes).toEqual([{ op: "delete", path: "households/h1/shoppingItems/i1" }]);
  });
});

describe("checkItem", () => {
  it("is one batch of exactly 3 writes: item, stats +1 (merge), «item_purchased»", async () => {
    await checkItem("h1", item({ name: "Milch 1/2 Fett" }), "nevio");
    expect(fake.state.commits).toHaveLength(1);
    expect(withoutAutoIds(fake.state.commits[0])).toEqual([
      {
        op: "update",
        path: "households/h1/shoppingItems/i1",
        data: {
          checked: true,
          checkedAt: "SERVER_TIME",
          checkedBy: "nevio",
          updatedAt: "SERVER_TIME",
        },
      },
      {
        op: "set",
        path: "households/h1/itemStats/milch 1∕2 fett",
        data: {
          name: "Milch 1/2 Fett",
          category: "groceries",
          count: "INCREMENT(1)",
          lastPurchasedAt: "SERVER_TIME",
        },
        options: { merge: true },
      },
      activity("item_purchased", "i1", "Milch 1/2 Fett"),
    ]);
  });
});

describe("uncheckItem", () => {
  const itemUncheck = {
    op: "update",
    path: "households/h1/shoppingItems/i1",
    data: {
      checked: false,
      checkedAt: "DELETE_FIELD",
      checkedBy: "DELETE_FIELD",
      updatedAt: "SERVER_TIME",
    },
  };
  const statDecrement = {
    op: "update",
    path: "households/h1/itemStats/milch",
    data: { count: "INCREMENT(-1)" },
  };

  it("writes the item alone, then the stats −1 as a separate write", async () => {
    await uncheckItem("h1", checked(), stat(3));
    expect(fake.state.commits).toEqual([]);
    expect(fake.state.writes).toEqual([itemUncheck, statDecrement]);
  });

  it("sends no stats write for a missing stats doc or count 0", async () => {
    await uncheckItem("h1", checked(), undefined);
    await uncheckItem("h1", checked(), stat(0));
    expect(fake.state.writes).toEqual([itemUncheck, itemUncheck]);
  });

  it("resolves even when the stats write is rejected", async () => {
    fake.state.rejectPaths.add("households/h1/itemStats/milch");
    await expect(uncheckItem("h1", checked(), stat(1))).resolves.toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fake.state.writes).toEqual([itemUncheck, statDecrement]);
  });
});

describe("clearCompleted / restoreItems", () => {
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => checked({ id: `c${i}`, name: `Artikel ${i}` }));

  it("deletes only checked items, in batches of at most 500", async () => {
    const items = [...many(1201), item({ id: "open" })];
    const { removed, committed } = clearCompleted("h1", items);
    await committed;
    expect(removed).toHaveLength(1201);
    expect(fake.state.commits.map((ops) => ops.length)).toEqual([500, 500, 201]);
    const paths = fake.state.commits.flat().map((op) => op.path);
    expect(paths).not.toContain("households/h1/shoppingItems/open");
    expect(fake.state.commits.flat().every((op) => op.op === "delete")).toBe(true);
    expect(paths.some((path) => path.includes("itemStats"))).toBe(false);
  });

  it("restores the removed items with their ids, fields and checked state", async () => {
    const old = checked({ id: "c1", quantity: "6", notes: "Nicht zu reif", createdBy: "anna" });
    await restoreItems("h1", [old]);
    expect(fake.state.commits).toEqual([
      [
        {
          op: "set",
          path: "households/h1/shoppingItems/c1",
          data: {
            name: "Milch",
            quantity: "6",
            notes: "Nicht zu reif",
            category: "groceries",
            checked: true,
            checkedAt: "TS(2026-10-02T10:00:00.000Z)",
            checkedBy: "anna",
            createdBy: "anna",
            createdAt: "SERVER_TIME",
            updatedAt: "SERVER_TIME",
          },
        },
      ],
    ]);
  });

  it("restores in batches of at most 500", async () => {
    await restoreItems("h1", many(501));
    expect(fake.state.commits.map((ops) => ops.length)).toEqual([500, 1]);
  });
});
