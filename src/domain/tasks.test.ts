import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import {
  buildNextOccurrence,
  changedTaskFields,
  compareTasks,
  daysBetweenKeys,
  dueGroup,
  endOfWeekKey,
  filterTasks,
  groupOpenTasks,
  hasFilters,
  isDueToday,
  isOverdue,
  isRecurring,
  isUnassigned,
  isUntouched,
  isWriteOutcomeReached,
  nextOccurrenceId,
  normalizeTaskInput,
  openTaskCount,
  orderedOpenTasks,
  recentlyCompleted,
  sortTasks,
  taskSummary,
  todayKey,
  validateTaskTitle,
  type TaskFilterContext,
} from "./tasks";

let seq = 0;
function task(overrides: Partial<Task> = {}): Task {
  seq += 1;
  return {
    id: `t${String(seq).padStart(3, "0")}`,
    title: `Aufgabe ${seq}`,
    assigneeId: null,
    dueDate: null,
    priority: "low",
    status: "open",
    createdBy: "nevio",
    createdAt: new Date(Date.UTC(2026, 8, 1, 10, 0, seq)),
    updatedAt: new Date(Date.UTC(2026, 8, 1, 10, 0, seq)),
    hasPendingWrites: false,
    ...overrides,
  };
}

const TODAY = "2026-09-30"; // Wednesday
const ctx: TaskFilterContext = { today: TODAY, weekStartsOn: 1, memberIds: ["nevio", "anna"] };

describe("todayKey", () => {
  it("is the calendar date in the household time zone, not UTC", () => {
    // 23:30 UTC on 30 Sept is already 1 Oct in Zurich (CEST, UTC+2).
    const now = new Date("2026-09-30T23:30:00Z");
    expect(todayKey(now, "Europe/Zurich")).toBe("2026-10-01");
    expect(todayKey(now, "America/New_York")).toBe("2026-09-30");
  });

  it("rolls over at local midnight across the DST change", () => {
    // 25 Oct 2026: Zurich switches back to CET (UTC+1).
    expect(todayKey(new Date("2026-10-24T21:59:00Z"), "Europe/Zurich")).toBe("2026-10-24");
    expect(todayKey(new Date("2026-10-24T22:00:00Z"), "Europe/Zurich")).toBe("2026-10-25");
    expect(todayKey(new Date("2026-10-25T22:59:00Z"), "Europe/Zurich")).toBe("2026-10-25");
    expect(todayKey(new Date("2026-10-25T23:00:00Z"), "Europe/Zurich")).toBe("2026-10-26");
  });
});

describe("dueGroup / isOverdue / isDueToday", () => {
  it("groups by date relative to today", () => {
    expect(dueGroup("2026-09-29", TODAY)).toBe("overdue");
    expect(dueGroup("2026-09-30", TODAY)).toBe("today");
    expect(dueGroup("2026-10-01", TODAY)).toBe("upcoming");
    expect(dueGroup(null, TODAY)).toBe("none");
  });

  it("counts only open tasks as overdue", () => {
    expect(isOverdue(task({ dueDate: "2026-09-29" }), TODAY)).toBe(true);
    expect(isOverdue(task({ dueDate: "2026-09-29", status: "done" }), TODAY)).toBe(false);
    expect(isOverdue(task({ dueDate: TODAY }), TODAY)).toBe(false);
    expect(isOverdue(task(), TODAY)).toBe(false);
  });

  it("knows a task due today", () => {
    expect(isDueToday(task({ dueDate: TODAY }), TODAY)).toBe(true);
    expect(isDueToday(task({ dueDate: "2026-10-01" }), TODAY)).toBe(false);
  });

  it("a task due today becomes overdue at the household's midnight", () => {
    const t = task({ dueDate: "2026-09-30" });
    expect(isOverdue(t, todayKey(new Date("2026-09-30T21:59:00Z"), "Europe/Zurich"))).toBe(false);
    expect(isOverdue(t, todayKey(new Date("2026-09-30T22:00:00Z"), "Europe/Zurich"))).toBe(true);
  });
});

describe("daysBetweenKeys", () => {
  it("counts calendar days, also across DST", () => {
    expect(daysBetweenKeys("2026-09-30", "2026-10-03")).toBe(3);
    expect(daysBetweenKeys("2026-10-24", "2026-10-26")).toBe(2);
    expect(daysBetweenKeys("2026-10-03", "2026-09-30")).toBe(-3);
  });
});

describe("endOfWeekKey", () => {
  // 28 Sept 2026 is a Monday.
  const week = [
    "2026-09-28",
    "2026-09-29",
    "2026-09-30",
    "2026-10-01",
    "2026-10-02",
    "2026-10-03",
    "2026-10-04",
  ];

  it("ends on Sunday when weeks start on Monday", () => {
    for (const day of week) expect(endOfWeekKey(day, 1)).toBe("2026-10-04");
    expect(endOfWeekKey("2026-10-05", 1)).toBe("2026-10-11");
  });

  it("ends on Saturday when weeks start on Sunday", () => {
    for (const day of week.slice(0, 6)) expect(endOfWeekKey(day, 0)).toBe("2026-10-03");
    expect(endOfWeekKey("2026-10-04", 0)).toBe("2026-10-10");
  });
});

describe("sorting (TSK-06)", () => {
  it("sorts by due date, no date last, then priority, then creation date", () => {
    const noDateHigh = task({ title: "ohne Datum hoch", priority: "high" });
    const laterLow = task({ title: "später", dueDate: "2026-10-05" });
    const overdue = task({ title: "überfällig", dueDate: "2026-09-20" });
    const todayLowOld = task({ title: "heute alt", dueDate: TODAY });
    const todayHigh = task({ title: "heute hoch", dueDate: TODAY, priority: "high" });
    const todayMedium = task({ title: "heute mittel", dueDate: TODAY, priority: "medium" });
    const todayLowNew = task({ title: "heute neu", dueDate: TODAY });
    const noDateLow = task({ title: "ohne Datum tief" });

    const sorted = sortTasks([
      noDateLow,
      todayLowNew,
      laterLow,
      noDateHigh,
      todayMedium,
      todayHigh,
      overdue,
      todayLowOld,
    ]);
    expect(sorted.map((t) => t.title)).toEqual([
      "überfällig",
      "heute hoch",
      "heute mittel",
      "heute alt",
      "heute neu",
      "später",
      "ohne Datum hoch",
      "ohne Datum tief",
    ]);
  });

  it("is stable on equal creation times (by id)", () => {
    const createdAt = new Date("2026-09-01T10:00:00Z");
    const a = task({ id: "a", createdAt });
    const b = task({ id: "b", createdAt });
    expect(compareTasks(a, b)).toBeLessThan(0);
    expect(compareTasks(b, a)).toBeGreaterThan(0);
    expect(compareTasks(a, a)).toBe(0);
  });
});

describe("groupOpenTasks", () => {
  it("returns the non-empty groups in order, only open tasks", () => {
    const tasks = [
      task({ title: "C", dueDate: "2026-10-02" }),
      task({ title: "A", dueDate: "2026-09-29" }),
      task({ title: "erledigt", dueDate: TODAY, status: "done" }),
      task({ title: "D" }),
    ];
    const groups = groupOpenTasks(tasks, TODAY);
    expect(groups.map((g) => [g.group, g.tasks.map((t) => t.title)])).toEqual([
      ["overdue", ["A"]],
      ["upcoming", ["C"]],
      ["none", ["D"]],
    ]);
    expect(orderedOpenTasks(tasks, TODAY).map((t) => t.title)).toEqual(["A", "C", "D"]);
  });
});

describe("filters (TSK-05, B2)", () => {
  const nevioToday = task({ title: "nevio heute", assigneeId: "nevio", dueDate: TODAY });
  const annaOverdue = task({
    title: "anna überfällig",
    assigneeId: "anna",
    dueDate: "2026-09-28",
    priority: "high",
  });
  const unassignedSunday = task({ title: "niemand sonntag", dueDate: "2026-10-04" });
  const formerMember = task({ title: "ehemalig", assigneeId: "lea", dueDate: "2026-10-05" });
  const nevioNoDate = task({ title: "nevio ohne", assigneeId: "nevio", priority: "high" });
  const all = [nevioToday, annaOverdue, unassignedSunday, formerMember, nevioNoDate];
  const titles = (tasks: Task[]) => tasks.map((t) => t.title);

  it("no filter keeps everything", () => {
    expect(filterTasks(all, {}, ctx)).toHaveLength(all.length);
    expect(hasFilters({})).toBe(false);
    expect(hasFilters({ priority: "high" })).toBe(true);
  });

  it("filters by assignee", () => {
    expect(titles(filterTasks(all, { assignee: "nevio" }, ctx))).toEqual([
      "nevio heute",
      "nevio ohne",
    ]);
    expect(titles(filterTasks(all, { assignee: "anna" }, ctx))).toEqual(["anna überfällig"]);
  });

  it("«Nicht zugewiesen» also matches someone who is no longer a member (D23)", () => {
    expect(titles(filterTasks(all, { assignee: "none" }, ctx))).toEqual([
      "niemand sonntag",
      "ehemalig",
    ]);
    expect(isUnassigned(null, ctx.memberIds)).toBe(true);
    expect(isUnassigned("lea", ctx.memberIds)).toBe(true);
    expect(isUnassigned("anna", ctx.memberIds)).toBe(false);
  });

  it("filters by due date", () => {
    expect(titles(filterTasks(all, { due: "overdue" }, ctx))).toEqual(["anna überfällig"]);
    expect(titles(filterTasks(all, { due: "today" }, ctx))).toEqual(["nevio heute"]);
    expect(titles(filterTasks(all, { due: "none" }, ctx))).toEqual(["nevio ohne"]);
  });

  it("«Diese Woche» includes overdue and ends with the week (B4)", () => {
    expect(titles(filterTasks(all, { due: "week" }, ctx))).toEqual([
      "nevio heute",
      "anna überfällig",
      "niemand sonntag",
    ]);
    // Weeks starting on Sunday end on Saturday: Sunday's task is next week.
    expect(titles(filterTasks(all, { due: "week" }, { ...ctx, weekStartsOn: 0 }))).toEqual([
      "nevio heute",
      "anna überfällig",
    ]);
  });

  it("filters by high priority", () => {
    expect(titles(filterTasks(all, { priority: "high" }, ctx))).toEqual([
      "anna überfällig",
      "nevio ohne",
    ]);
  });

  it("combines filters with AND", () => {
    expect(titles(filterTasks(all, { assignee: "nevio", priority: "high" }, ctx))).toEqual([
      "nevio ohne",
    ]);
    expect(titles(filterTasks(all, { assignee: "anna", due: "today" }, ctx))).toEqual([]);
    expect(
      titles(filterTasks(all, { assignee: "none", due: "week", priority: "high" }, ctx)),
    ).toEqual([]);
  });
});

describe("recentlyCompleted (B5, TSK-09)", () => {
  const now = new Date("2026-09-30T12:00:00Z");
  const DAY = 24 * 60 * 60 * 1000;

  it("keeps the last 30 days, newest first; exactly 30 days is still in", () => {
    const fresh = task({
      title: "frisch",
      status: "done",
      completedAt: new Date(now.getTime() - 60_000),
    });
    const edge = task({
      title: "grenze",
      status: "done",
      completedAt: new Date(now.getTime() - 30 * DAY),
    });
    const old = task({
      title: "alt",
      status: "done",
      completedAt: new Date(now.getTime() - 30 * DAY - 1),
    });
    const week = task({
      title: "woche",
      status: "done",
      completedAt: new Date(now.getTime() - 7 * DAY),
    });
    const open = task({ title: "offen" });
    expect(recentlyCompleted([edge, old, open, fresh, week], now).map((t) => t.title)).toEqual([
      "frisch",
      "woche",
      "grenze",
    ]);
  });

  it("ignores done tasks without a completion time", () => {
    expect(recentlyCompleted([task({ status: "done" })], now)).toEqual([]);
  });
});

describe("summary and counts", () => {
  it("counts all open, overdue and due-today tasks", () => {
    const tasks = [
      task({ dueDate: "2026-09-29" }),
      task({ dueDate: TODAY }),
      task({ dueDate: TODAY }),
      task({ dueDate: TODAY, status: "done" }),
      task(),
    ];
    expect(taskSummary(tasks, TODAY)).toEqual({ open: 4, overdue: 1, today: 2 });
    expect(openTaskCount(tasks)).toBe(4);
  });
});

describe("validateTaskTitle / normalizeTaskInput", () => {
  it("trims and checks 1–200 characters", () => {
    expect(validateTaskTitle("  Bad putzen ")).toEqual({ ok: true, title: "Bad putzen" });
    expect(validateTaskTitle("   ")).toEqual({ ok: false, error: "empty" });
    expect(validateTaskTitle("x".repeat(200))).toMatchObject({ ok: true });
    expect(validateTaskTitle("x".repeat(201))).toEqual({ ok: false, error: "tooLong" });
  });

  it("trims title and notes and drops empty notes", () => {
    expect(
      normalizeTaskInput({
        title: " Bad ",
        notes: "  Spiegel  ",
        assigneeId: "anna",
        dueDate: TODAY,
        priority: "medium",
      }),
    ).toEqual({
      title: "Bad",
      notes: "Spiegel",
      assigneeId: "anna",
      dueDate: TODAY,
      priority: "medium",
    });
    expect(
      normalizeTaskInput({
        title: "Bad",
        notes: "   ",
        assigneeId: null,
        dueDate: null,
        priority: "low",
      }),
    ).toEqual({ title: "Bad", assigneeId: null, dueDate: null, priority: "low" });
  });
});

describe("changedTaskFields (B8)", () => {
  const before = task({
    title: "Bad putzen",
    notes: "Spiegel",
    assigneeId: "nevio",
    dueDate: TODAY,
    priority: "medium",
  });
  const same = {
    title: "Bad putzen",
    notes: "Spiegel",
    assigneeId: "nevio",
    dueDate: TODAY,
    priority: "medium" as const,
  };

  it("is empty when nothing changed", () => {
    expect(changedTaskFields(before, same)).toEqual({});
  });

  it("returns only the changed fields", () => {
    expect(changedTaskFields(before, { ...same, title: "Bad", assigneeId: null })).toEqual({
      title: "Bad",
      assigneeId: null,
    });
    expect(changedTaskFields(before, { ...same, dueDate: null, priority: "high" })).toEqual({
      dueDate: null,
      priority: "high",
    });
  });

  it("returns notes: null when the notes were emptied", () => {
    expect(changedTaskFields(before, { ...same, notes: undefined })).toEqual({ notes: null });
  });

  it("returns new notes", () => {
    const plain = task({ title: "X" });
    expect(
      changedTaskFields(plain, {
        title: "X",
        notes: "neu",
        assigneeId: null,
        dueDate: null,
        priority: "low",
      }),
    ).toEqual({ notes: "neu" });
  });
});

describe("isWriteOutcomeReached (D21)", () => {
  it("is reached when the task is already in the intended state", () => {
    expect(isWriteOutcomeReached(task({ status: "done" }), "complete")).toBe(true);
    expect(isWriteOutcomeReached(task({ status: "open" }), "complete")).toBe(false);
    expect(isWriteOutcomeReached(undefined, "complete")).toBe(false);
    expect(isWriteOutcomeReached(task({ status: "open" }), "reopen")).toBe(true);
    expect(isWriteOutcomeReached(task({ status: "done" }), "reopen")).toBe(false);
    expect(isWriteOutcomeReached(undefined, "delete")).toBe(true);
    expect(isWriteOutcomeReached(task(), "delete")).toBe(false);
    expect(isWriteOutcomeReached(task(), "edit")).toBe(false);
    expect(isWriteOutcomeReached(undefined, "create")).toBe(false);
  });
});

describe("recurring tasks (Phase 4)", () => {
  const weeklySat = { freq: "weekly" as const, interval: 1, byWeekday: [6] };
  const bathroom = (overrides: Partial<Task> = {}) =>
    task({
      id: "s1",
      title: "Bad putzen",
      notes: "Spiegel",
      assigneeId: "nevio",
      dueDate: "2026-10-03",
      priority: "medium",
      recurrence: weeklySat,
      rotation: { memberIds: ["nevio", "anna"], index: 0 },
      seriesId: "s1",
      seriesIndex: 1,
      ...overrides,
    });
  const recurrenceCtx = {
    today: "2026-10-04",
    weekStartsOn: 1 as const,
    memberIds: ["nevio", "anna"],
  };

  it("isRecurring: open with a rule; a completed occurrence keeps its rule but doesn't count (B7)", () => {
    expect(isRecurring(bathroom())).toBe(true);
    expect(isRecurring(bathroom({ status: "done" }))).toBe(false);
    expect(isRecurring(task())).toBe(false);
  });

  it("nextOccurrenceId: «{seriesId}-{n+1}» (B5)", () => {
    expect(nextOccurrenceId(bathroom())).toBe("s1-2");
    expect(nextOccurrenceId(bathroom({ seriesId: "s1", seriesIndex: 4 }))).toBe("s1-5");
    expect(nextOccurrenceId(task())).toBeUndefined();
  });

  it("buildNextOccurrence on completion: next date, next assignee, same fields (acceptance criterion)", () => {
    expect(buildNextOccurrence(bathroom(), recurrenceCtx, { advanceRotation: true })).toEqual({
      id: "s1-2",
      title: "Bad putzen",
      notes: "Spiegel",
      assigneeId: "anna",
      dueDate: "2026-10-10",
      priority: "medium",
      recurrence: weeklySat,
      rotation: { memberIds: ["nevio", "anna"], index: 1 },
      seriesId: "s1",
      seriesIndex: 2,
    });
  });

  it("«Nur diese» keeps the assignee (B8)", () => {
    const next = buildNextOccurrence(bathroom(), recurrenceCtx, { advanceRotation: false });
    expect(next.assigneeId).toBe("nevio");
    expect(next.rotation).toEqual({ memberIds: ["nevio", "anna"], index: 0 });
  });

  it("without rotation keeps the assignee, unless they left", () => {
    const plain = bathroom({ rotation: undefined, notes: undefined });
    const next = buildNextOccurrence(plain, recurrenceCtx, { advanceRotation: true });
    expect(next.assigneeId).toBe("nevio");
    expect(next).not.toHaveProperty("rotation");
    expect(next).not.toHaveProperty("notes");
    const left = buildNextOccurrence(
      plain,
      { ...recurrenceCtx, memberIds: ["anna"] },
      {
        advanceRotation: true,
      },
    );
    expect(left.assigneeId).toBeNull();
  });

  it("a rotation with one member left ends", () => {
    const next = buildNextOccurrence(
      bathroom(),
      { ...recurrenceCtx, memberIds: ["nevio"] },
      {
        advanceRotation: true,
      },
    );
    expect(next.assigneeId).toBe("nevio");
    expect(next).not.toHaveProperty("rotation");
  });

  it("throws for a task that doesn't repeat", () => {
    expect(() => buildNextOccurrence(task(), recurrenceCtx, { advanceRotation: true })).toThrow();
  });

  it("isUntouched: open and never edited (B9)", () => {
    const created = new Date("2026-10-04T10:00:00Z");
    expect(isUntouched(bathroom({ createdAt: created, updatedAt: created }))).toBe(true);
    expect(
      isUntouched(bathroom({ createdAt: created, updatedAt: new Date("2026-10-04T11:00:00Z") })),
    ).toBe(false);
    expect(isUntouched(bathroom({ createdAt: created, updatedAt: created, status: "done" }))).toBe(
      false,
    );
  });

  it("changedTaskFields writes rule and rotation only when they change (B4)", () => {
    const before = bathroom();
    const same = {
      title: before.title,
      notes: before.notes,
      assigneeId: before.assigneeId,
      dueDate: before.dueDate,
      priority: before.priority,
      recurrence: { freq: "weekly" as const, interval: 1, byWeekday: [6] },
      rotation: { memberIds: ["anna", "nevio"], index: 1 },
    };
    expect(changedTaskFields(before, same)).toEqual({});
    expect(
      changedTaskFields(before, { ...same, recurrence: undefined, rotation: undefined }),
    ).toEqual({
      recurrence: null,
      rotation: null,
    });
    expect(
      changedTaskFields(before, {
        ...same,
        assigneeId: "anna",
        rotation: { memberIds: ["anna", "nevio"], index: 0 },
      }),
    ).toEqual({ assigneeId: "anna", rotation: { memberIds: ["anna", "nevio"], index: 0 } });
  });

  it("normalizeTaskInput keeps a rule and drops a rotation without one", () => {
    const input = {
      title: "Bad",
      assigneeId: "nevio",
      dueDate: "2026-10-03",
      priority: "low" as const,
    };
    const rotation = { memberIds: ["nevio", "anna"], index: 0 };
    expect(normalizeTaskInput({ ...input, rotation })).toEqual(input);
    expect(normalizeTaskInput({ ...input, recurrence: weeklySat, rotation })).toEqual({
      ...input,
      recurrence: weeklySat,
      rotation,
    });
  });
});
