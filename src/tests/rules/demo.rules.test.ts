import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  arrayRemove,
  collection,
  deleteDoc,
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
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { buildDemoData, type DemoDoc } from "../../demo/demoData";
import {
  CODE,
  HID,
  anna,
  asAdmin,
  createTestEnvironment,
  dbAs,
  nevio,
  seedHousehold,
  type TestUser,
} from "./helpers";

// Phase 9 §9.12: the demo dataset against the rules, the demo guard (C4, C5) and the isolation
// from a real household in the same project (C7).

const demo1: TestUser = {
  uid: "demo1",
  email: "demo1@example.com",
  displayName: "Demo User 1",
  initials: "D1",
  avatarColor: 5,
};
const demo2: TestUser = {
  uid: "demo2",
  email: "demo2@example.com",
  displayName: "Demo User 2",
  initials: "D2",
  avatarColor: 2,
};
const DEMO = "demo";
const NOW = new Date();

const data = buildDemoData({
  now: NOW,
  householdId: DEMO,
  inviteCode: "DEM-1234",
  users: [demo1, demo2],
});
const userOf = (uid: unknown) => (uid === demo2.uid ? demo2 : demo1);
const sub = (name: string) => data.docs.filter((d) => d.path.split("/")[2] === name);

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createTestEnvironment();
});

afterAll(async () => {
  await env.cleanup();
});

async function seed(docs: DemoDoc[]) {
  await asAdmin(env, async (db) => {
    for (const { path, data: fields } of docs) await setDoc(doc(db, path), fields);
  });
}

/** Profiles, household (with `demo`), members and invite, as the setup script writes them. */
async function seedBase() {
  await seed(
    data.docs.filter(
      (d) =>
        d.path.startsWith("users/") ||
        d.path.startsWith("invites/") ||
        d.path === `households/${DEMO}` ||
        d.path.startsWith(`households/${DEMO}/members/`),
    ),
  );
}

const ref = (db: Firestore, path: string) => doc(db, path);

describe("demo dataset: shape against the rules (weaker than a literal pass)", () => {
  // The dataset can't pass the rules literally: they want server time for createdAt and
  // friends, counts that start at 1, and no `demo` key. So each document is written by its
  // demo user after a transform. This catches field names, types, enums and lengths drifting
  // from the rules, not timestamps, counts or the batch shapes of the real write paths.
  beforeEach(async () => {
    await env.clearFirestore();
    await seedBase();
  });

  it("tasks: open ones as created, done ones created open and then completed", async () => {
    for (const { path, data: fields } of sub("tasks")) {
      const { completedAt, completedBy, status, ...open } = fields;
      void completedAt;
      const creator = dbAs(env, userOf(fields.createdBy));
      await assertSucceeds(
        setDoc(ref(creator, path), {
          ...open,
          status: "open",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      );
      if (status === "done") {
        await assertSucceeds(
          updateDoc(ref(dbAs(env, userOf(completedBy)), path), {
            status: "done",
            completedAt: serverTimestamp(),
            completedBy,
            updatedAt: serverTimestamp(),
          }),
        );
      }
    }
  });

  it("shopping items: open ones as created, bought ones like a restore", async () => {
    for (const { path, data: fields } of sub("shoppingItems")) {
      const writer = dbAs(env, userOf(fields.checked ? fields.checkedBy : fields.createdBy));
      await assertSucceeds(
        setDoc(ref(writer, path), {
          ...fields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      );
    }
  });

  it("purchase stats: a create with 1 plus an increment", async () => {
    for (const { path, data: fields } of sub("itemStats")) {
      const db = dbAs(env, demo1);
      await assertSucceeds(
        setDoc(ref(db, path), { ...fields, count: 1, lastPurchasedAt: serverTimestamp() }),
      );
      await assertSucceeds(
        updateDoc(ref(db, path), {
          ...fields,
          count: increment(1),
          lastPurchasedAt: serverTimestamp(),
        }),
      );
    }
  });

  it("events: every recurring series as created", async () => {
    for (const { path, data: fields } of sub("events")) {
      await assertSucceeds(
        setDoc(ref(dbAs(env, userOf(fields.createdBy)), path), {
          ...fields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      );
    }
  });

  it("activity: every entry next to its target, by its actor", async () => {
    await seed([...sub("tasks"), ...sub("shoppingItems"), ...sub("events")]);
    const items = new Map(sub("shoppingItems").map((d) => [d.path.split("/").at(-1), d.data]));
    for (const { path, data: fields } of sub("activity")) {
      // «item_added» needs the item to be open: purchased items were open back then.
      if (fields.type === "item_added" && items.get(fields.targetId as string)?.checked) continue;
      await assertSucceeds(
        setDoc(ref(dbAs(env, userOf(fields.actorId)), path), {
          ...fields,
          createdAt: serverTimestamp(),
        }),
      );
    }
  });
});

describe("demo guard (C4, C5) on the demo dataset", () => {
  beforeEach(async () => {
    await env.clearFirestore();
    await seed(data.docs);
  });

  const householdRef = (db: Firestore) => doc(db, "households", DEMO);

  it("denies leaving, removing, handing over and deleting", async () => {
    const db2 = dbAs(env, demo2);
    const leave = writeBatch(db2);
    leave.update(householdRef(db2), {
      memberIds: arrayRemove(demo2.uid),
      rotationOrder: arrayRemove(demo2.uid),
      updatedAt: serverTimestamp(),
    });
    leave.delete(doc(db2, "households", DEMO, "members", demo2.uid));
    leave.update(doc(db2, "users", demo2.uid), { householdId: null });
    await assertFails(leave.commit());

    const db1 = dbAs(env, demo1);
    const remove = writeBatch(db1);
    remove.update(householdRef(db1), {
      memberIds: arrayRemove(demo2.uid),
      rotationOrder: arrayRemove(demo2.uid),
      updatedAt: serverTimestamp(),
    });
    remove.delete(doc(db1, "households", DEMO, "members", demo2.uid));
    await assertFails(remove.commit());

    const handOver = writeBatch(db1);
    handOver.update(householdRef(db1), { ownerId: demo2.uid, updatedAt: serverTimestamp() });
    handOver.update(doc(db1, "households", DEMO, "members", demo1.uid), { role: "member" });
    handOver.update(doc(db1, "households", DEMO, "members", demo2.uid), { role: "owner" });
    await assertFails(handOver.commit());

    await assertFails(
      updateDoc(householdRef(db1), {
        deleting: true,
        memberIds: [demo1.uid],
        rotationOrder: [],
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(deleteDoc(householdRef(db1)));
  });

  it("denies renaming the household and the demo users", async () => {
    const db1 = dbAs(env, demo1);
    await assertFails(
      updateDoc(householdRef(db1), { name: "Troll-WG", updatedAt: serverTimestamp() }),
    );
    const rename = writeBatch(db1);
    rename.update(doc(db1, "users", demo1.uid), { displayName: "Troll", initials: "TR" });
    rename.update(doc(db1, "households", DEMO, "members", demo1.uid), {
      displayName: "Troll",
      initials: "TR",
    });
    await assertFails(rename.commit());
  });

  it("allows everything a visitor should try", async () => {
    const db2 = dbAs(env, demo2);
    await assertSucceeds(
      setDoc(doc(db2, "households", DEMO, "tasks", "visitor"), {
        title: "Ausprobieren",
        assigneeId: demo2.uid,
        dueDate: null,
        priority: "low",
        status: "open",
        createdBy: demo2.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(db2, "households", DEMO, "shoppingItems", "demo-item-milch"), {
        quantity: "3 l",
        updatedAt: serverTimestamp(),
      }),
    );
    const colour = writeBatch(db2);
    colour.update(doc(db2, "users", demo2.uid), { avatarColor: 7 });
    colour.update(doc(db2, "households", DEMO, "members", demo2.uid), { avatarColor: 7 });
    await assertSucceeds(colour.commit());
    await assertSucceeds(
      updateDoc(householdRef(dbAs(env, demo1)), { weekStartsOn: 0, updatedAt: serverTimestamp() }),
    );
  });
});

describe("isolation from a real household (C7)", () => {
  beforeEach(async () => {
    await env.clearFirestore();
    await seed(data.docs);
    await seedHousehold(env, { members: [anna] });
  });

  it("keeps demo users out of «Musterstrasse 12» and its invite", async () => {
    const db = dbAs(env, demo1);
    await assertFails(getDoc(doc(db, "households", HID)));
    await assertFails(getDocs(collection(db, "households", HID, "tasks")));
    await assertFails(getDocs(collection(db, "households", HID, "activity")));
    await assertFails(getDoc(doc(db, "invites", CODE)));
    await assertFails(
      setDoc(doc(db, "households", HID, "tasks", "x"), {
        title: "Hallo",
        assigneeId: null,
        dueDate: null,
        priority: "low",
        status: "open",
        createdBy: demo1.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("doesn't let a demo user join another household or create one", async () => {
    const db = dbAs(env, demo2);
    const join = writeBatch(db);
    join.update(doc(db, "households", HID), {
      memberIds: [nevio.uid, anna.uid, demo2.uid],
      updatedAt: serverTimestamp(),
    });
    join.set(doc(db, "households", HID, "members", demo2.uid), {
      displayName: demo2.displayName,
      initials: demo2.initials,
      avatarColor: demo2.avatarColor,
      role: "member",
      joinedAt: serverTimestamp(),
      joinedWithCode: CODE,
    });
    join.update(doc(db, "users", demo2.uid), { householdId: HID });
    await assertFails(join.commit());

    const create = writeBatch(db);
    create.set(doc(db, "households", "mine"), {
      name: "Meins",
      ownerId: demo2.uid,
      memberIds: [demo2.uid],
      weekStartsOn: 1,
      timeZone: "Europe/Zurich",
      inviteCode: "MIN-1234",
      inviteCreatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    create.update(doc(db, "users", demo2.uid), { householdId: "mine" });
    await assertFails(create.commit());
  });
});
