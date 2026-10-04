import { vi } from "vitest";
import type { RecurrenceContext } from "../domain/tasks";
import type {
  Household,
  ItemStat,
  Member,
  NewShoppingItemInput,
  NewTaskInput,
  ShoppingItem,
  ShoppingItemChanges,
  Task,
  TaskChanges,
  UserProfile,
} from "../types";

/**
 * In-memory stand-ins for the household, member and invite services, for component and
 * routing tests. Use with:
 *   vi.mock("../lib/firebase", () => ({ auth: {}, db: {} }));
 *   vi.mock("../services/householdService", () => import("./householdFakes").then((f) => f.householdServiceMock));
 */

export const nevioProfile: UserProfile = {
  uid: "nevio",
  displayName: "Nevio",
  email: "nevio@example.ch",
  initials: "NE",
  avatarColor: 6,
  householdId: "h1",
  createdAt: new Date("2026-09-01T10:00:00Z"),
};

export function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: "h1",
    name: "Musterstrasse 12",
    ownerId: "nevio",
    memberIds: ["nevio", "anna"],
    weekStartsOn: 1,
    timeZone: "Europe/Zurich",
    inviteCode: "MST-4821",
    inviteCreatedAt: new Date(),
    createdAt: new Date("2026-09-14T10:00:00Z"),
    updatedAt: new Date("2026-09-14T10:00:00Z"),
    ...overrides,
  };
}

export function makeMember(overrides: Partial<Member> & { uid: string }): Member {
  return {
    displayName: overrides.uid,
    initials: overrides.uid.slice(0, 2).toUpperCase(),
    avatarColor: 1,
    role: "member",
    joinedAt: new Date("2026-09-20T10:00:00Z"),
    ...overrides,
  };
}

let taskSeq = 0;

/** A task as the provider exposes it; open, unassigned, no date, «Niedrig» by default. */
export function makeTask(overrides: Partial<Task> = {}): Task {
  taskSeq += 1;
  return {
    id: `task${taskSeq}`,
    title: `Aufgabe ${taskSeq}`,
    assigneeId: null,
    dueDate: null,
    priority: "low",
    status: "open",
    createdBy: "nevio",
    createdAt: new Date(Date.UTC(2026, 8, 1, 10, 0, taskSeq)),
    updatedAt: new Date(Date.UTC(2026, 8, 1, 10, 0, taskSeq)),
    hasPendingWrites: false,
    ...overrides,
  };
}

let itemSeq = 0;

/** A shopping item as the provider exposes it; open «Lebensmittel» by default. */
export function makeItem(overrides: Partial<ShoppingItem> = {}): ShoppingItem {
  itemSeq += 1;
  return {
    id: `item${itemSeq}`,
    name: `Artikel ${itemSeq}`,
    category: "groceries",
    checked: false,
    createdBy: "nevio",
    createdAt: new Date(Date.UTC(2026, 8, 1, 10, 0, itemSeq)),
    updatedAt: new Date(Date.UTC(2026, 8, 1, 10, 0, itemSeq)),
    hasPendingWrites: false,
    ...overrides,
  };
}

export const defaultMembers = (): Member[] => [
  makeMember({ uid: "anna", displayName: "Anna", initials: "AN" }),
  makeMember({
    uid: "nevio",
    displayName: "Nevio",
    initials: "NE",
    avatarColor: 6,
    role: "owner",
    joinedAt: new Date("2026-09-14T10:00:00Z"),
  }),
];

interface Listener<T> {
  hid: string;
  onChange: (value: T) => void;
  onError: (error: Error) => void;
}

export const fakeStore = {
  household: makeHousehold() as Household | null,
  members: defaultMembers(),
  tasks: [] as Task[],
  /** When set, the listeners fail with it. */
  error: null as Error | null,
  /** When set, only the task listener fails with it. */
  tasksError: null as Error | null,
  /** The task listener doesn't answer until emitTasks() (D13). */
  holdTasks: false,
  items: [] as ShoppingItem[],
  itemStats: [] as ItemStat[],
  /** When set, only the shopping listener fails with it. */
  itemsError: null as Error | null,
  /** The shopping listener doesn't answer until emitItems() (D38). */
  holdItems: false,
  /** Listeners don't answer until emit() (loading state). */
  hold: false,
  householdListeners: new Set<Listener<Household | null>>(),
  memberListeners: new Set<Listener<Member[]>>(),
  taskListeners: new Set<Listener<Task[]>>(),
  itemListeners: new Set<Listener<ShoppingItem[]>>(),
  statListeners: new Set<Listener<ItemStat[]>>(),
  /** Household ids in subscription / unsubscription order. */
  subscribed: [] as string[],
  unsubscribed: [] as string[],

  reset() {
    this.household = makeHousehold();
    this.members = defaultMembers();
    this.tasks = [];
    this.error = null;
    this.tasksError = null;
    this.hold = false;
    this.holdTasks = false;
    this.items = [];
    this.itemStats = [];
    this.itemsError = null;
    this.holdItems = false;
    this.itemListeners.clear();
    this.statListeners.clear();
    this.householdListeners.clear();
    this.memberListeners.clear();
    this.taskListeners.clear();
    this.subscribed = [];
    this.unsubscribed = [];
  },

  /** Delivers the current state to every listener. */
  emit() {
    for (const listener of this.householdListeners) deliverHousehold(listener);
    for (const listener of this.memberListeners) deliverMembers(listener);
    this.emitTasks();
    this.emitItems();
  },

  /** Delivers the current shopping items and stats to their listeners. */
  emitItems() {
    for (const listener of this.itemListeners) deliverItems(listener);
    for (const listener of this.statListeners) listener.onChange(this.itemStats);
  },

  /** Replaces the shopping items (and optionally the stats) and delivers them. */
  setItems(items: ShoppingItem[], itemStats?: ItemStat[]) {
    this.items = items;
    if (itemStats) this.itemStats = itemStats;
    this.emitItems();
  },

  /** Delivers the current tasks to every task listener. */
  emitTasks() {
    for (const listener of this.taskListeners) deliverTasks(listener);
  },

  /** Replaces the tasks and delivers them (another member's change, a server echo). */
  setTasks(tasks: Task[]) {
    this.tasks = tasks;
    this.emitTasks();
  },
};

function deliverTasks(listener: Listener<Task[]>) {
  if (fakeStore.tasksError) listener.onError(fakeStore.tasksError);
  else listener.onChange(fakeStore.tasks);
}

function deliverItems(listener: Listener<ShoppingItem[]>) {
  if (fakeStore.itemsError) listener.onError(fakeStore.itemsError);
  else listener.onChange(fakeStore.items);
}

function deliverHousehold(listener: Listener<Household | null>) {
  if (fakeStore.error) listener.onError(fakeStore.error);
  else listener.onChange(fakeStore.household);
}

function deliverMembers(listener: Listener<Member[]>) {
  if (fakeStore.error) listener.onError(fakeStore.error);
  else listener.onChange(fakeStore.members);
}

function listen<T>(
  set: Set<Listener<T>>,
  deliver: (listener: Listener<T>) => void,
  hid: string,
  onChange: (value: T) => void,
  onError: (error: Error) => void,
) {
  const listener = { hid, onChange, onError };
  set.add(listener);
  if (!fakeStore.hold) deliver(listener);
  return () => {
    set.delete(listener);
  };
}

export const householdServiceMock = {
  listenToHousehold: (
    hid: string,
    onChange: (household: Household | null) => void,
    onError: (error: Error) => void,
  ) => {
    fakeStore.subscribed.push(hid);
    const stop = listen(fakeStore.householdListeners, deliverHousehold, hid, onChange, onError);
    return () => {
      fakeStore.unsubscribed.push(hid);
      stop();
    };
  },
  createHousehold: vi.fn<(profile: UserProfile, name: string) => Promise<string>>(),
  updateHouseholdSettings: vi.fn(),
};

export const memberServiceMock = {
  listenToMembers: (
    hid: string,
    onChange: (members: Member[]) => void,
    onError: (error: Error) => void,
  ) => listen(fakeStore.memberListeners, deliverMembers, hid, onChange, onError),
  updateMyProfile: vi.fn(),
};

export const taskServiceMock = {
  listenToTasks: (
    hid: string,
    onChange: (tasks: Task[]) => void,
    onError: (error: Error) => void,
  ) => {
    const listener = { hid, onChange, onError };
    fakeStore.taskListeners.add(listener);
    if (!fakeStore.holdTasks) deliverTasks(listener);
    return () => {
      fakeStore.taskListeners.delete(listener);
    };
  },
  createTask:
    vi.fn<
      (
        hid: string,
        input: NewTaskInput,
        actorId: string,
      ) => { id: string; committed: Promise<void> }
    >(),
  updateTask:
    vi.fn<
      (
        hid: string,
        task: Task,
        changes: TaskChanges,
        actorId: string,
        nameOf: (uid: string) => string | undefined,
      ) => Promise<void>
    >(),
  completeTask:
    vi.fn<(hid: string, task: Task, actorId: string, ctx?: RecurrenceContext) => Promise<void>>(),
  reopenTask: vi.fn<(hid: string, task: Task, tasks?: readonly Task[]) => Promise<void>>(),
  deleteTask: vi.fn<(hid: string, task: Task) => Promise<void>>(),
  deleteOccurrence:
    vi.fn<(hid: string, task: Task, actorId: string, ctx: RecurrenceContext) => Promise<void>>(),
  deleteSeries: vi.fn<(hid: string, task: Task) => Promise<void>>(),
};

export const shoppingServiceMock = {
  BATCH_LIMIT: 500,
  listenToItems: (
    hid: string,
    onChange: (items: ShoppingItem[]) => void,
    onError: (error: Error) => void,
  ) => {
    const listener = { hid, onChange, onError };
    fakeStore.itemListeners.add(listener);
    if (!fakeStore.holdItems) deliverItems(listener);
    return () => {
      fakeStore.itemListeners.delete(listener);
    };
  },
  listenToItemStats: (
    hid: string,
    onChange: (stats: ItemStat[]) => void,
    onError: (error: Error) => void,
  ) => {
    const listener = { hid, onChange, onError };
    fakeStore.statListeners.add(listener);
    if (!fakeStore.holdItems) onChange(fakeStore.itemStats);
    return () => {
      fakeStore.statListeners.delete(listener);
    };
  },
  addItem:
    vi.fn<
      (
        hid: string,
        input: NewShoppingItemInput,
        actorId: string,
      ) => { id: string; committed: Promise<void> }
    >(),
  readdItem:
    vi.fn<
      (
        hid: string,
        checkedItem: ShoppingItem,
        actorId: string,
      ) => { id: string; committed: Promise<void> }
    >(),
  updateItem: vi.fn<(hid: string, itemId: string, changes: ShoppingItemChanges) => Promise<void>>(),
  deleteItem: vi.fn<(hid: string, itemId: string) => Promise<void>>(),
  checkItem: vi.fn<(hid: string, item: ShoppingItem, actorId: string) => Promise<void>>(),
  uncheckItem:
    vi.fn<(hid: string, item: ShoppingItem, stat: ItemStat | undefined) => Promise<void>>(),
  clearCompleted:
    vi.fn<
      (
        hid: string,
        items: readonly ShoppingItem[],
      ) => { removed: ShoppingItem[]; committed: Promise<void> }
    >(),
  restoreItems: vi.fn<(hid: string, items: readonly ShoppingItem[]) => Promise<void>>(),
};
