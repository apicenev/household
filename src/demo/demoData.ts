import { addDaysToKey, daysInMonth, dateKey, keyParts, weekdayOfKey } from "../domain/dateKeys";
import { allDayToStored, zonedToInstant } from "../domain/eventTime";
import { initialsFor } from "../domain/member";
import { statKey } from "../domain/shopping";
import { todayKey } from "../domain/tasks";
import type {
  EventCategory,
  EventParticipants,
  RecurrenceRule,
  ShopCategory,
  TaskPriority,
} from "../types";

/**
 * The demo household (Phase 9 C2, C3, C11, §9.9): one dataset for the setup script, the
 * emulator seed, the E2E tests and the screenshots. Pure and deterministic for a given `now`.
 *
 * It stays current without a reset (C3): no task has a due date, and every event repeats
 * without an end, starting a few weeks before `now`. Completed tasks, purchases and the feed
 * lie in the three weeks before `now` and simply age.
 *
 * Values are plain JS (Dates for timestamps), so the Admin SDK and the client SDK both write
 * them as they are.
 */

export const DEMO_HOUSEHOLD_NAME = "Demo-Haushalt";
export const DEMO_NAMES = ["Demo User 1", "Demo User 2"] as const;
/** Seegrün and Honig (`AvatarColorPicker` order). */
export const DEMO_COLORS = [5, 2] as const;

export interface DemoUser {
  uid: string;
  email: string;
}

export interface DemoOptions {
  now: Date;
  householdId: string;
  inviteCode: string;
  /** Demo User 1 (owner) and Demo User 2. */
  users: readonly [DemoUser, DemoUser];
  timeZone?: string;
  /**
   * Screenshots only (§9.15): two tasks due today, so Start shows «Heute» as designed. Never
   * written to the real demo, where they'd turn overdue.
   */
  dueToday?: boolean;
}

export interface DemoDoc {
  /** Firestore path, e.g. «households/demo/tasks/demo-task-kueche-putzen». */
  path: string;
  data: Record<string, unknown>;
}

export interface DemoData {
  /** Profiles, household, members, invite first; then tasks, items, stats, events, activity. */
  docs: DemoDoc[];
  householdId: string;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** «Küche putzen» → «kueche-putzen» (fixed ids, so a rerun overwrites instead of adding). */
export function slug(text: string): string {
  return text
    .toLocaleLowerCase("de-CH")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface OpenTask {
  title: string;
  assignee: 0 | 1 | null;
  priority: TaskPriority;
  notes?: string;
  createdBy: 0 | 1;
  /** Days before `now`. */
  createdDaysAgo: number;
}

const OPEN_TASKS: OpenTask[] = [
  { title: "Küche putzen", assignee: null, priority: "high", createdBy: 0, createdDaysAgo: 2 },
  {
    title: "Wäsche zusammenlegen",
    assignee: 1,
    priority: "low",
    createdBy: 0,
    createdDaysAgo: 2,
  },
  { title: "Pflanzen giessen", assignee: 1, priority: "low", createdBy: 1, createdDaysAgo: 3 },
  {
    title: "Stromrechnung bezahlen",
    assignee: 0,
    priority: "medium",
    notes: "Betrag 84.50, Einzahlungsschein liegt auf dem Pult.",
    createdBy: 0,
    createdDaysAgo: 4,
  },
  {
    title: "Glühbirne im Flur ersetzen",
    assignee: null,
    priority: "low",
    createdBy: 1,
    createdDaysAgo: 6,
  },
  { title: "Velo-Service buchen", assignee: 0, priority: "low", createdBy: 0, createdDaysAgo: 8 },
  {
    title: "Geschenk für Grosi besorgen",
    assignee: 1,
    priority: "medium",
    notes: "Sie wünscht sich ein Buch über Bergblumen.",
    createdBy: 1,
    createdDaysAgo: 5,
  },
  { title: "Fenster putzen", assignee: null, priority: "low", createdBy: 0, createdDaysAgo: 9 },
  { title: "Keller aufräumen", assignee: 0, priority: "high", createdBy: 1, createdDaysAgo: 11 },
  { title: "Altglas entsorgen", assignee: 1, priority: "low", createdBy: 0, createdDaysAgo: 2 },
  {
    title: "Steuererklärung vorbereiten",
    assignee: 0,
    priority: "medium",
    notes: "Lohnausweise und Belege sammeln.",
    createdBy: 0,
    createdDaysAgo: 12,
  },
  {
    title: "Duschvorhang waschen",
    assignee: null,
    priority: "low",
    createdBy: 1,
    createdDaysAgo: 7,
  },
];

interface DoneTask {
  title: string;
  by: 0 | 1;
  /** Completed this many days before `now`, at `time` (household zone). */
  daysAgo: number;
  time: string;
}

const DONE_TASKS: DoneTask[] = [
  { title: "Bad putzen", by: 1, daysAgo: 1, time: "18:40" },
  { title: "Staubsaugen", by: 0, daysAgo: 2, time: "09:15" },
  { title: "Kühlschrank abtauen", by: 0, daysAgo: 3, time: "19:05" },
  { title: "Bettwäsche wechseln", by: 1, daysAgo: 4, time: "08:30" },
  { title: "Altpapier bündeln", by: 0, daysAgo: 5, time: "20:10" },
  { title: "Bad putzen", by: 0, daysAgo: 8, time: "17:55" },
  { title: "Backofen reinigen", by: 1, daysAgo: 9, time: "16:20" },
  { title: "Staubsaugen", by: 1, daysAgo: 10, time: "10:45" },
  { title: "Pflanzen giessen", by: 1, daysAgo: 12, time: "07:50" },
  { title: "Vorhänge waschen", by: 0, daysAgo: 14, time: "11:30" },
];

interface Item {
  name: string;
  category: ShopCategory;
  quantity?: string;
  notes?: string;
  by: 0 | 1;
  /** Added this many hours before `now`. */
  hoursAgo: number;
}

const OPEN_ITEMS: Item[] = [
  { name: "Milch", category: "groceries", quantity: "2 l", by: 0, hoursAgo: 30 },
  { name: "Brot", category: "groceries", by: 1, hoursAgo: 28 },
  { name: "Eier", category: "groceries", quantity: "6", by: 0, hoursAgo: 52 },
  { name: "Tomaten", category: "groceries", quantity: "500 g", by: 1, hoursAgo: 50 },
  { name: "Bananen", category: "groceries", by: 0, hoursAgo: 75 },
  { name: "Gruyère", category: "groceries", notes: "am Stück", by: 1, hoursAgo: 74 },
  { name: "Kaffeebohnen", category: "groceries", by: 0, hoursAgo: 98 },
  { name: "Haferflocken", category: "groceries", by: 1, hoursAgo: 120 },
  { name: "WC-Papier", category: "household", quantity: "1 Pack.", by: 0, hoursAgo: 49 },
  { name: "Geschirrspültabs", category: "household", by: 1, hoursAgo: 96 },
  { name: "Abfallsäcke", category: "household", quantity: "35 l", by: 0, hoursAgo: 140 },
  { name: "Pflaster", category: "pharmacy", by: 1, hoursAgo: 26 },
  { name: "Batterien AA", category: "other", by: 0, hoursAgo: 145 },
];

interface Purchase extends Item {
  /** Bought this many days before `now`, at `time`. */
  boughtDaysAgo: number;
  time: string;
}

/** Demo User 2's burst the evening before (D79) and one purchase by Demo User 1. */
const PURCHASES: Purchase[] = [
  {
    name: "Joghurt",
    category: "groceries",
    by: 1,
    hoursAgo: 70,
    boughtDaysAgo: 1,
    time: "19:10",
  },
  { name: "Äpfel", category: "groceries", by: 0, hoursAgo: 96, boughtDaysAgo: 1, time: "19:14" },
  { name: "Butter", category: "groceries", by: 0, hoursAgo: 60, boughtDaysAgo: 1, time: "19:21" },
  {
    name: "Olivenöl",
    category: "groceries",
    by: 1,
    hoursAgo: 120,
    boughtDaysAgo: 1,
    time: "19:27",
  },
  {
    name: "Spülmittel",
    category: "household",
    by: 1,
    hoursAgo: 100,
    boughtDaysAgo: 2,
    time: "18:05",
  },
];

/** Purchase history for «Oft gekauft» and the suggestions: name, category, count. */
const STATS: Array<[string, ShopCategory, number]> = [
  ["Milch", "groceries", 18],
  ["Brot", "groceries", 15],
  ["Eier", "groceries", 12],
  ["Bananen", "groceries", 11],
  ["Joghurt", "groceries", 10],
  ["Tomaten", "groceries", 9],
  ["Butter", "groceries", 9],
  ["Äpfel", "groceries", 8],
  ["Käse", "groceries", 8],
  ["Kaffeebohnen", "groceries", 7],
  ["Zwiebeln", "groceries", 7],
  ["Avocados", "groceries", 6],
  ["Zitronen", "groceries", 6],
  ["Haferflocken", "groceries", 6],
  ["Gruyère", "groceries", 5],
  ["Olivenöl", "groceries", 5],
  ["Teigwaren", "groceries", 5],
  ["Reis", "groceries", 4],
  ["Karotten", "groceries", 4],
  ["Kartoffeln", "groceries", 4],
  ["Salat", "groceries", 4],
  ["Hafermilch", "groceries", 3],
  ["Rüebli", "groceries", 3],
  ["Mineralwasser", "groceries", 3],
  ["Schokolade", "groceries", 3],
  ["Basilikum", "groceries", 2],
  ["Mehl", "groceries", 2],
  ["Zucker", "groceries", 2],
  ["WC-Papier", "household", 8],
  ["Geschirrspültabs", "household", 6],
  ["Spülmittel", "household", 5],
  ["Abfallsäcke", "household", 4],
  ["Haushaltpapier", "household", 4],
  ["Waschmittel", "household", 3],
  ["Schwämme", "household", 2],
  ["Pflaster", "pharmacy", 3],
  ["Ibuprofen", "pharmacy", 2],
  ["Sonnencreme", "pharmacy", 1],
  ["Batterien AA", "other", 2],
  ["Geschenkpapier", "other", 1],
];

interface DemoEvent {
  title: string;
  category: EventCategory;
  /** Owner (0), Demo User 2 (1), both, or «Alle». */
  participants: "all" | Array<0 | 1>;
  /** First occurrence (on the schedule) and its times; all-day without times. */
  first: string;
  from?: string;
  to?: string;
  /** All-day: number of days (default 1). */
  days?: number;
  recurrence: RecurrenceRule;
  description?: string;
  createdBy: 0 | 1;
}

/** The first `weekday` (0 = Sunday) on or after `key`. */
function weekdayFrom(key: string, weekday: number): string {
  return addDaysToKey(key, (weekday - weekdayOfKey(key) + 7) % 7);
}

/** The last `weekday` of the month of `key`. */
function lastWeekdayOfMonth(key: string, weekday: number): string {
  const { year, month } = keyParts(key);
  const last = dateKey(year, month, daysInMonth(year, month));
  return addDaysToKey(last, -((weekdayOfKey(last) - weekday + 7) % 7));
}

/** «Every week has at least three entries» (C3) and every rule type the picker offers. */
function demoEvents(today: string): DemoEvent[] {
  const { year, month } = keyParts(today);
  const monthBefore = month === 1 ? dateKey(year - 1, 12, 1) : dateKey(year, month - 1, 1);
  // The birthday is 9 days ahead; the series starts a year earlier (29 Feb → 1 Mar).
  let birthday = addDaysToKey(today, 9);
  const parts = keyParts(birthday);
  birthday = dateKey(parts.year - 1, parts.month, Math.min(parts.day, 28));
  const birthdayParts = keyParts(birthday);
  return [
    {
      title: "Yoga",
      category: "social",
      participants: [1],
      first: weekdayFrom(addDaysToKey(today, -27), 2),
      from: "18:30",
      to: "19:45",
      recurrence: { freq: "weekly", interval: 1, byWeekday: [2] },
      createdBy: 1,
    },
    {
      title: "Fussballtraining",
      category: "social",
      participants: [0],
      first: weekdayFrom(addDaysToKey(today, -27), 4),
      from: "19:00",
      to: "20:30",
      recurrence: { freq: "weekly", interval: 1, byWeekday: [4] },
      createdBy: 0,
    },
    {
      title: "Wocheneinkauf",
      category: "home",
      participants: "all",
      first: weekdayFrom(addDaysToKey(today, -27), 6),
      from: "09:00",
      to: "10:00",
      recurrence: { freq: "weekly", interval: 1, byWeekday: [6] },
      createdBy: 0,
    },
    {
      title: "Grossputz",
      category: "home",
      participants: "all",
      first: weekdayFrom(addDaysToKey(today, -20), 6),
      from: "10:00",
      to: "12:00",
      recurrence: { freq: "weekly", interval: 2, byWeekday: [6] },
      description: "Bad, Küche, Böden. Musik an!",
      createdBy: 0,
    },
    {
      title: "Altpapiersammlung",
      category: "reminder",
      participants: "all",
      first: weekdayFrom(addDaysToKey(today, -20), 2),
      recurrence: { freq: "weekly", interval: 2, byWeekday: [2] },
      description: "Papier gebündelt bis 7:00 an die Strasse.",
      createdBy: 1,
    },
    {
      title: "Znacht bei den Eltern",
      category: "social",
      participants: "all",
      first: weekdayFrom(addDaysToKey(today, -30), 0),
      from: "18:00",
      to: "21:00",
      recurrence: { freq: "weekly", interval: 4, byWeekday: [0] },
      createdBy: 1,
    },
    {
      title: "Pflanzen düngen",
      category: "reminder",
      participants: [1],
      first: addDaysToKey(today, -25),
      recurrence: { freq: "daily", interval: 10 },
      createdBy: 1,
    },
    {
      title: "Miete bezahlen",
      category: "reminder",
      participants: [0],
      first: dateKey(keyParts(monthBefore).year, keyParts(monthBefore).month, 25),
      recurrence: { freq: "monthly", interval: 1, byMonthDay: 25 },
      createdBy: 0,
    },
    {
      title: "Spieleabend",
      category: "social",
      participants: "all",
      first: lastWeekdayOfMonth(monthBefore, 5),
      from: "20:00",
      to: "23:30",
      recurrence: { freq: "monthly", interval: 1, byWeekday: [5], bySetPos: -1 },
      createdBy: 1,
    },
    {
      title: "Grosis Geburtstag",
      category: "social",
      participants: "all",
      first: birthday,
      recurrence: {
        freq: "yearly",
        interval: 1,
        byMonth: birthdayParts.month,
        byMonthDay: birthdayParts.day,
      },
      createdBy: 1,
    },
    {
      title: "Skiferien",
      category: "travel",
      participants: [0, 1],
      first: dateKey(year - 1, 2, 7),
      days: 7,
      recurrence: { freq: "yearly", interval: 1, byMonth: 2, byMonthDay: 7 },
      description: "Lenzerheide, Ferienwohnung bei Familie Caduff.",
      createdBy: 0,
    },
  ];
}

/** Builds every document of the demo household for `now`. */
export function buildDemoData({
  now,
  householdId,
  inviteCode,
  users,
  timeZone = "Europe/Zurich",
  dueToday = false,
}: DemoOptions): DemoData {
  const today = todayKey(now, timeZone);
  const uid = (index: 0 | 1) => users[index].uid;
  const at = (daysAgo: number, time: string) =>
    zonedToInstant(addDaysToKey(today, -daysAgo), time, timeZone);
  const hoursBefore = (hours: number) => new Date(now.getTime() - hours * HOUR_MS);
  const created = new Date(now.getTime() - 21 * DAY_MS);
  const hid = householdId;
  const docs: DemoDoc[] = [];
  const activity: Array<Record<string, unknown>> = [];
  const record = (
    actor: 0 | 1,
    type: string,
    targetType: string,
    targetId: string,
    targetTitle: string,
    createdAt: Date,
    details?: Record<string, unknown>,
  ) =>
    activity.push({
      actorId: uid(actor),
      type,
      targetType,
      targetId,
      targetTitle,
      ...(details ? { details } : {}),
      createdAt,
    });

  // Profiles, household, members, invite.
  users.forEach((user, index) => {
    docs.push({
      path: `users/${user.uid}`,
      data: {
        displayName: DEMO_NAMES[index],
        email: user.email,
        initials: initialsFor(DEMO_NAMES[index]),
        avatarColor: DEMO_COLORS[index],
        householdId: hid,
        createdAt: created,
      },
    });
  });
  docs.push({
    path: `households/${hid}`,
    data: {
      name: DEMO_HOUSEHOLD_NAME,
      ownerId: uid(0),
      memberIds: [uid(0), uid(1)],
      weekStartsOn: 1,
      timeZone,
      inviteCode,
      inviteCreatedAt: now,
      rotationOrder: [uid(0), uid(1)],
      demo: true,
      createdAt: created,
      updatedAt: now,
    },
  });
  const joined = new Date(now.getTime() - 20 * DAY_MS);
  users.forEach((user, index) => {
    docs.push({
      path: `households/${hid}/members/${user.uid}`,
      data: {
        displayName: DEMO_NAMES[index],
        initials: initialsFor(DEMO_NAMES[index]),
        avatarColor: DEMO_COLORS[index],
        role: index === 0 ? "owner" : "member",
        joinedAt: index === 0 ? created : joined,
        ...(index === 1 ? { joinedWithCode: inviteCode } : {}),
      },
    });
  });
  docs.push({
    path: `invites/${inviteCode}`,
    data: {
      householdId: hid,
      householdName: DEMO_HOUSEHOLD_NAME,
      ownerName: DEMO_NAMES[0],
      memberCount: 2,
      createdBy: uid(0),
      createdAt: now,
    },
  });
  record(1, "member_joined", "member", uid(1), DEMO_NAMES[1], joined);

  // Tasks: open without due dates, completed with their history (C3).
  for (const task of OPEN_TASKS) {
    const id = `demo-task-${slug(task.title)}`;
    const createdAt = at(task.createdDaysAgo, "08:00");
    docs.push({
      path: `households/${hid}/tasks/${id}`,
      data: {
        title: task.title,
        ...(task.notes ? { notes: task.notes } : {}),
        assigneeId: task.assignee === null ? null : uid(task.assignee),
        dueDate: null,
        priority: task.priority,
        status: "open",
        createdBy: uid(task.createdBy),
        createdAt,
        updatedAt: createdAt,
      },
    });
    record(task.createdBy, "task_created", "task", id, task.title, createdAt);
  }
  if (dueToday) {
    for (const [title, assignee] of [
      ["Altpapier rausbringen", 0],
      ["Znacht kochen", 1],
    ] as const) {
      const id = `demo-today-${slug(title)}`;
      const createdAt = at(1, "20:00");
      docs.push({
        path: `households/${hid}/tasks/${id}`,
        data: {
          title,
          assigneeId: uid(assignee),
          dueDate: today,
          priority: assignee === 0 ? "high" : "low",
          status: "open",
          createdBy: uid(0),
          createdAt,
          updatedAt: createdAt,
        },
      });
      record(0, "task_created", "task", id, title, createdAt);
    }
  }
  // One reassignment with «Vorher» (D78).
  const laundry = `demo-task-${slug("Wäsche zusammenlegen")}`;
  record(0, "task_assigned", "task", laundry, "Wäsche zusammenlegen", at(1, "07:30"), {
    fromId: uid(0),
    fromName: DEMO_NAMES[0],
    toId: uid(1),
    toName: DEMO_NAMES[1],
  });
  DONE_TASKS.forEach((task, index) => {
    const id = `demo-done-${index + 1}-${slug(task.title)}`;
    const createdAt = at(task.daysAgo + 2, "08:00");
    const completedAt = at(task.daysAgo, task.time);
    docs.push({
      path: `households/${hid}/tasks/${id}`,
      data: {
        title: task.title,
        assigneeId: uid(task.by),
        dueDate: null,
        priority: "low",
        status: "done",
        completedAt,
        completedBy: uid(task.by),
        createdBy: uid(task.by === 0 ? 1 : 0),
        createdAt,
        updatedAt: completedAt,
      },
    });
    record(task.by === 0 ? 1 : 0, "task_created", "task", id, task.title, createdAt);
    record(task.by, "task_completed", "task", id, task.title, completedAt);
  });

  // Shopping: open items, the purchases, the history.
  for (const item of OPEN_ITEMS) {
    const id = `demo-item-${slug(item.name)}`;
    const createdAt = hoursBefore(item.hoursAgo);
    docs.push({
      path: `households/${hid}/shoppingItems/${id}`,
      data: {
        name: item.name,
        ...(item.quantity ? { quantity: item.quantity } : {}),
        ...(item.notes ? { notes: item.notes } : {}),
        category: item.category,
        checked: false,
        createdBy: uid(item.by),
        createdAt,
        updatedAt: createdAt,
      },
    });
    record(item.by, "item_added", "item", id, item.name, createdAt);
  }
  for (const item of PURCHASES) {
    const id = `demo-item-${slug(item.name)}`;
    const createdAt = hoursBefore(item.hoursAgo);
    const checkedAt = at(item.boughtDaysAgo, item.time);
    const buyer = item.boughtDaysAgo === 1 ? 1 : 0;
    docs.push({
      path: `households/${hid}/shoppingItems/${id}`,
      data: {
        name: item.name,
        category: item.category,
        checked: true,
        checkedAt,
        checkedBy: uid(buyer),
        createdBy: uid(item.by),
        createdAt,
        updatedAt: checkedAt,
      },
    });
    record(item.by, "item_added", "item", id, item.name, createdAt);
    record(buyer, "item_purchased", "item", id, item.name, checkedAt);
  }
  STATS.forEach(([name, category, count], index) => {
    docs.push({
      path: `households/${hid}/itemStats/${statKey(name)}`,
      data: { name, category, count, lastPurchasedAt: hoursBefore(30 + index * 7) },
    });
  });

  // Events: all recurring, never ending (C3).
  demoEvents(today).forEach((event, index) => {
    const id = `demo-event-${slug(event.title)}`;
    const createdAt = hoursBefore(24 * 21 - index * 9);
    const times =
      event.from && event.to
        ? {
            allDay: false,
            start: zonedToInstant(event.first, event.from, timeZone),
            end: zonedToInstant(event.first, event.to, timeZone),
          }
        : {
            allDay: true,
            ...allDayToStored(event.first, addDaysToKey(event.first, (event.days ?? 1) - 1)),
          };
    const participants: EventParticipants =
      event.participants === "all"
        ? "household"
        : event.participants.length === 2
          ? "household"
          : event.participants.map((index) => uid(index));
    docs.push({
      path: `households/${hid}/events/${id}`,
      data: {
        title: event.title,
        ...(event.description ? { description: event.description } : {}),
        category: event.category,
        ...times,
        participants,
        recurrence: event.recurrence,
        createdBy: uid(event.createdBy),
        createdAt,
        updatedAt: createdAt,
      },
    });
    record(event.createdBy, "event_created", "event", id, event.title, createdAt);
  });

  // The feed, oldest first, with ids in that order.
  activity
    .sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime())
    .forEach((entry, index) => {
      docs.push({
        path: `households/${hid}/activity/demo-activity-${String(index + 1).padStart(3, "0")}`,
        data: entry,
      });
    });

  return { docs, householdId: hid };
}
