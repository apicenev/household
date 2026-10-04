import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  Timestamp,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { statKey } from "../../domain/shopping";
import {
  HID,
  anna,
  asAdmin,
  createTestEnvironment,
  dbAs,
  lea,
  nevio,
  seedHousehold,
  seedProfiles,
  type TestUser,
} from "./helpers";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createTestEnvironment();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedProfiles(env, lea);
  await seedHousehold(env, { members: [anna] });
});

const itemPath = (id = "i1") => ["households", HID, "shoppingItems", id] as const;
const statPath = (key: string) => ["households", HID, "itemStats", key] as const;

/** A new item as shoppingService.addItem writes it. */
function newItem(user: TestUser, overrides: Record<string, unknown> = {}) {
  return {
    name: "Milch",
    category: "groceries",
    checked: false,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

/** Seeds an item directly (bypassing the rules). */
async function seedItem(id = "i1", overrides: Record<string, unknown> = {}) {
  await asAdmin(env, async (db) => {
    const now = new Date();
    await setDoc(doc(db, ...itemPath(id)), {
      name: "Milch",
      quantity: "2 l",
      category: "groceries",
      checked: false,
      createdBy: nevio.uid,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    });
  });
}

async function seedStat(name: string, count: number, overrides: Record<string, unknown> = {}) {
  await asAdmin(env, async (db) => {
    await setDoc(doc(db, ...statPath(statKey(name))), {
      name,
      category: "groceries",
      count,
      lastPurchasedAt: new Date(),
      ...overrides,
    });
  });
}

async function readStatCount(name: string): Promise<number | undefined> {
  let count: number | undefined;
  await asAdmin(env, async (db) => {
    count = (await getDoc(doc(db, ...statPath(statKey(name))))).data()?.count;
  });
  return count;
}

/** The check batch as shoppingService.checkItem writes it. */
function checkBatch(
  db: Firestore,
  user: TestUser,
  options: { id?: string; name?: string; item?: object; stat?: object; activity?: object } = {},
) {
  const { id = "i1", name = "Milch" } = options;
  const batch = writeBatch(db);
  batch.update(doc(db, ...itemPath(id)), {
    checked: true,
    checkedAt: serverTimestamp(),
    checkedBy: user.uid,
    updatedAt: serverTimestamp(),
    ...options.item,
  });
  batch.set(
    doc(db, ...statPath(statKey(name))),
    {
      name,
      category: "groceries",
      count: increment(1),
      lastPurchasedAt: serverTimestamp(),
      ...options.stat,
    },
    { merge: true },
  );
  batch.set(doc(collection(db, "households", HID, "activity")), {
    actorId: user.uid,
    type: "item_purchased",
    targetType: "item",
    targetId: id,
    targetTitle: name,
    createdAt: serverTimestamp(),
    ...options.activity,
  });
  return batch;
}

const uncheck = (db: Firestore, id = "i1") =>
  updateDoc(doc(db, ...itemPath(id)), {
    checked: false,
    checkedAt: deleteField(),
    checkedBy: deleteField(),
    updatedAt: serverTimestamp(),
  });

describe("shoppingItems: access", () => {
  it("lets members read and denies outsiders everything", async () => {
    await seedItem();
    await assertSucceeds(getDocs(collection(dbAs(env, anna), "households", HID, "shoppingItems")));
    const outsider = dbAs(env, lea);
    await assertFails(getDoc(doc(outsider, ...itemPath())));
    await assertFails(setDoc(doc(outsider, ...itemPath("i2")), newItem(lea)));
    await assertFails(updateDoc(doc(outsider, ...itemPath()), { name: "Brot" }));
    await assertFails(deleteDoc(doc(outsider, ...itemPath())));
    await assertFails(getDocs(collection(outsider, "households", HID, "itemStats")));
  });
});

describe("shoppingItems: create", () => {
  it("accepts a new open item with optional quantity and notes", async () => {
    const db = dbAs(env, anna);
    await assertSucceeds(setDoc(doc(db, ...itemPath("a")), newItem(anna)));
    await assertSucceeds(
      setDoc(
        doc(db, ...itemPath("b")),
        newItem(anna, { quantity: "500 g", notes: "Laktosefrei", category: "pharmacy" }),
      ),
    );
  });

  it("rejects invalid fields", async () => {
    const db = dbAs(env, anna);
    const bad: Record<string, unknown>[] = [
      { name: "" },
      { name: "x".repeat(101) },
      { name: " Milch" },
      { name: "Milch " },
      { name: "Hafer  Milch" },
      { name: "Hafer\tMilch" },
      { category: "tools" },
      { quantity: "" },
      { quantity: "x".repeat(31) },
      { notes: "x".repeat(501) },
      { createdBy: nevio.uid },
      { createdAt: new Date() },
      { checkedBy: anna.uid },
      { extra: true },
    ];
    const passed: string[] = [];
    for (const overrides of bad) {
      try {
        await setDoc(doc(db, ...itemPath("x")), newItem(anna, overrides));
        passed.push(JSON.stringify(overrides));
      } catch {
        // denied, as expected
      }
    }
    expect(passed).toEqual([]);
  });

  it("accepts a name with 100 characters and single spaces", async () => {
    const db = dbAs(env, anna);
    await assertSucceeds(setDoc(doc(db, ...itemPath("x")), newItem(anna, { name: "Hafer Milch" })));
    await assertSucceeds(
      setDoc(doc(db, ...itemPath("y")), newItem(anna, { name: "x".repeat(100) })),
    );
  });

  it("accepts the restore of a checked item, also bought and created by someone else", async () => {
    const db = dbAs(env, anna);
    const restored = newItem(nevio, {
      checked: true,
      checkedBy: nevio.uid,
      checkedAt: Timestamp.fromDate(new Date(Date.now() - 60_000)),
    });
    await assertSucceeds(setDoc(doc(db, ...itemPath("r")), restored));
  });

  it("rejects a checked create without its purchase fields or with a future checkedAt", async () => {
    const db = dbAs(env, anna);
    await assertFails(setDoc(doc(db, ...itemPath("r")), newItem(anna, { checked: true })));
    await assertFails(
      setDoc(
        doc(db, ...itemPath("r")),
        newItem(anna, {
          checked: true,
          checkedBy: anna.uid,
          checkedAt: Timestamp.fromDate(new Date(Date.now() + 3_600_000)),
        }),
      ),
    );
  });
});

describe("shoppingItems: update", () => {
  it("lets members edit name, quantity, notes and category", async () => {
    await seedItem();
    const ref = doc(dbAs(env, anna), ...itemPath());
    await assertSucceeds(
      updateDoc(ref, {
        name: "Hafermilch",
        notes: "Bio",
        category: "other",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(updateDoc(ref, { quantity: deleteField(), updatedAt: serverTimestamp() }));
  });

  it("rejects invalid edits and edits of other fields", async () => {
    await seedItem();
    const ref = doc(dbAs(env, anna), ...itemPath());
    await assertFails(updateDoc(ref, { name: "", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { category: "tools", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { name: "Brot" }));
    await assertFails(updateDoc(ref, { createdBy: anna.uid, updatedAt: serverTimestamp() }));
    await assertFails(
      updateDoc(ref, { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
    );
  });

  it("allows a check only by oneself at server time", async () => {
    await seedItem();
    const ref = doc(dbAs(env, anna), ...itemPath());
    await assertFails(
      updateDoc(ref, {
        checked: true,
        checkedAt: serverTimestamp(),
        checkedBy: nevio.uid,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(ref, {
        checked: true,
        checkedAt: new Date(),
        checkedBy: anna.uid,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(ref, {
        checked: true,
        checkedAt: serverTimestamp(),
        checkedBy: anna.uid,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("allows an uncheck that removes the purchase fields", async () => {
    await seedItem("i1", { checked: true, checkedAt: new Date(), checkedBy: nevio.uid });
    const db = dbAs(env, anna);
    await assertFails(
      updateDoc(doc(db, ...itemPath()), { checked: false, updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(uncheck(db));
  });

  it("keeps checkedBy on edits of a checked item", async () => {
    await seedItem("i1", { checked: true, checkedAt: new Date(), checkedBy: nevio.uid });
    const ref = doc(dbAs(env, anna), ...itemPath());
    await assertSucceeds(updateDoc(ref, { notes: "Bio", updatedAt: serverTimestamp() }));
    await assertFails(
      updateDoc(ref, { notes: "Bio", checkedBy: anna.uid, updatedAt: serverTimestamp() }),
    );
  });

  it("lets members delete", async () => {
    await seedItem();
    await assertSucceeds(deleteDoc(doc(dbAs(env, anna), ...itemPath())));
  });
});

describe("check batch with itemStats and activity", () => {
  it("creates the stats doc with count 1 on the first purchase, then adds 1", async () => {
    await seedItem();
    await assertSucceeds(checkBatch(dbAs(env, anna), anna).commit());
    expect(await readStatCount("Milch")).toBe(1);
    await seedItem("i2");
    await assertSucceeds(checkBatch(dbAs(env, nevio), nevio, { id: "i2" }).commit());
    expect(await readStatCount("Milch")).toBe(2);
  });

  it("rejects a purchase entry for an item that isn't checked or with another title", async () => {
    await seedItem();
    const db = dbAs(env, anna);
    await assertFails(
      checkBatch(db, anna, { item: { checked: false, checkedAt: deleteField() } }).commit(),
    );
    await assertFails(checkBatch(db, anna, { activity: { targetTitle: "Brot" } }).commit());
    await assertFails(checkBatch(db, anna, { activity: { details: { x: 1 } } }).commit());
  });

  it("accepts keys built with statKey for non-ASCII names (lower() matches the client)", async () => {
    const db = dbAs(env, anna);
    const failed: string[] = [];
    for (const [id, name] of [
      ["a", "ÄPFEL"],
      ["b", "Éclair"],
      ["c", "Grüße"],
      ["d", "Milch 1/2 Fett"],
    ]) {
      await seedItem(id, { name });
      try {
        await checkBatch(db, anna, { id, name }).commit();
      } catch {
        failed.push(name);
      }
    }
    expect(failed).toEqual([]);
  });

  it("checks the key exactly for ASCII names, loosely for others (lower() is ASCII-only)", async () => {
    const db = dbAs(env, anna);
    const stat = (name: string) => ({
      name,
      category: "groceries",
      count: 1,
      lastPurchasedAt: serverTimestamp(),
    });
    await assertFails(setDoc(doc(db, ...statPath("xyz")), stat("Milch")));
    await assertFails(setDoc(doc(db, ...statPath("Milch")), stat("Milch")));
    // Fallback (§5.4): «ÄPFEL».lower() stays «ÄPFEL» in the rules, so non-ASCII names only
    // need a plausible key.
    await assertSucceeds(setDoc(doc(db, ...statPath("xyz")), stat("ÄPFEL")));
  });

  it("rejects a new stats doc with another count, time or fields", async () => {
    const db = dbAs(env, anna);
    const stat = {
      name: "Milch",
      category: "groceries",
      count: 1,
      lastPurchasedAt: serverTimestamp(),
    };
    const ref = doc(db, ...statPath("milch"));
    await assertFails(setDoc(ref, { ...stat, count: 2 }));
    await assertFails(setDoc(ref, { ...stat, lastPurchasedAt: new Date() }));
    await assertFails(setDoc(ref, { ...stat, category: "tools" }));
    await assertFails(setDoc(ref, { ...stat, extra: true }));
    await assertSucceeds(setDoc(ref, stat));
  });

  it("allows +1 with a new purchase time and −1 down to 0, nothing else", async () => {
    await seedStat("Milch", 1);
    const ref = doc(dbAs(env, anna), ...statPath("milch"));
    await assertFails(updateDoc(ref, { count: increment(2), lastPurchasedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { count: increment(1) }));
    await assertFails(updateDoc(ref, { count: increment(-1), category: "other" }));
    await assertSucceeds(updateDoc(ref, { count: increment(-1) }));
    await assertFails(updateDoc(ref, { count: increment(-1) }));
    await assertSucceeds(
      updateDoc(ref, {
        count: increment(1),
        lastPurchasedAt: serverTimestamp(),
        category: "household",
      }),
    );
  });

  it("never deletes stats", async () => {
    await seedStat("Milch", 3);
    await assertFails(deleteDoc(doc(dbAs(env, nevio), ...statPath("milch"))));
  });
});

describe("uncheck independent of itemStats (B6)", () => {
  it("succeeds when the stats doc is missing", async () => {
    await seedItem("i1", { checked: true, checkedAt: new Date(), checkedBy: nevio.uid });
    await assertSucceeds(uncheck(dbAs(env, anna)));
  });

  it("succeeds when the stats count is already 0", async () => {
    await seedItem("i1", { checked: true, checkedAt: new Date(), checkedBy: nevio.uid });
    await seedStat("Milch", 0);
    await assertSucceeds(uncheck(dbAs(env, anna)));
    expect(await readStatCount("Milch")).toBe(0);
  });
});

describe("activity: item_added", () => {
  function addBatch(
    db: Firestore,
    user: TestUser,
    activity: Record<string, unknown> = {},
    item: Record<string, unknown> = {},
  ) {
    const batch = writeBatch(db);
    batch.set(doc(db, ...itemPath("n1")), newItem(user, item));
    batch.set(doc(collection(db, "households", HID, "activity")), {
      actorId: user.uid,
      type: "item_added",
      targetType: "item",
      targetId: "n1",
      targetTitle: "Milch",
      createdAt: serverTimestamp(),
      ...activity,
    });
    return batch;
  }

  it("accepts the entry with the item in the same batch", async () => {
    await assertSucceeds(addBatch(dbAs(env, anna), anna).commit());
  });

  it("rejects a wrong title, target type or a foreign actor", async () => {
    const db = dbAs(env, anna);
    await assertFails(addBatch(db, anna, { targetTitle: "Brot" }).commit());
    await assertFails(addBatch(db, anna, { targetType: "task" }).commit());
    await assertFails(addBatch(db, anna, { actorId: nevio.uid }).commit());
  });

  it("rejects an entry without the item", async () => {
    await assertFails(
      setDoc(doc(collection(dbAs(env, anna), "households", HID, "activity")), {
        actorId: anna.uid,
        type: "item_added",
        targetType: "item",
        targetId: "missing",
        targetTitle: "Milch",
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("accepts the re-add batch: delete the checked item, create a new one, item_added", async () => {
    await seedItem("old", { checked: true, checkedAt: new Date(), checkedBy: nevio.uid });
    const db = dbAs(env, anna);
    const batch = addBatch(db, anna);
    batch.delete(doc(db, ...itemPath("old")));
    await assertSucceeds(batch.commit());
  });
});
