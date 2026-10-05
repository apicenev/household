import { describe, expect, it } from "vitest";
import { makeEvent, makeItem, makeTask } from "../tests/householdFakes";
import type { RecurrenceRule } from "../types";
import {
  lastCompleted,
  nextDueTask,
  overdueTasks,
  shoppingPreview,
  todayState,
  todayTasks,
  upcomingWeek,
} from "./dashboard";
import { allDayToStored } from "./eventTime";
import { todayKey } from "./tasks";

const ZURICH = "Europe/Zurich";
/** Mi., 30. Sept. 2026, 08:12 in Zurich. */
const NOW = new Date("2026-09-30T06:12:00Z");
const TODAY = "2026-09-30";

const titles = (tasks: { title: string }[]) => tasks.map((task) => task.title);

describe("overdue and today (DSH-02, DSH-03)", () => {
  const tasks = [
    makeTask({ title: "Pflanzen giessen", dueDate: "2026-09-29", assigneeId: "nevio" }),
    makeTask({ title: "Altpapier", dueDate: TODAY, assigneeId: "nevio" }),
    makeTask({ title: "Küche putzen", dueDate: TODAY, assigneeId: "anna", priority: "high" }),
    makeTask({ title: "Erledigt heute", dueDate: TODAY, status: "done" }),
    makeTask({ title: "Ohne Datum" }),
    makeTask({ title: "Morgen", dueDate: "2026-10-01" }),
    makeTask({ title: "Ehemalig", dueDate: "2026-09-20", assigneeId: "lea" }),
  ];

  it("lists open overdue tasks of every member, oldest due first", () => {
    expect(titles(overdueTasks(tasks, TODAY))).toEqual(["Ehemalig", "Pflanzen giessen"]);
  });

  it("lists open tasks due today, Hoch first; no date, done and later ones are left out", () => {
    expect(titles(todayTasks(tasks, TODAY))).toEqual(["Küche putzen", "Altpapier"]);
  });

  it("switches at local midnight in the household zone", () => {
    const task = [makeTask({ title: "Bad", dueDate: "2026-09-30" })];
    const before = todayKey(new Date("2026-09-30T21:59:00Z"), ZURICH);
    const after = todayKey(new Date("2026-09-30T22:00:00Z"), ZURICH);
    expect(titles(todayTasks(task, before))).toEqual(["Bad"]);
    expect(titles(overdueTasks(task, after))).toEqual(["Bad"]);
    // 23:59 on 30 Sept in New York is already 1 Oct in Zurich.
    const newYork = todayKey(new Date("2026-10-01T03:59:00Z"), "America/New_York");
    expect(titles(todayTasks(task, newYork))).toEqual(["Bad"]);
  });
});

describe("todayState (D67)", () => {
  it("is «open» while something due today is open", () => {
    expect(todayState([makeTask({ dueDate: TODAY })], TODAY)).toBe("open");
  });

  it("is «allDone» after a task due today was completed and nothing is overdue", () => {
    const tasks = [
      makeTask({ dueDate: TODAY, status: "done" }),
      makeTask({ dueDate: "2026-10-03" }),
    ];
    expect(todayState(tasks, TODAY)).toBe("allDone");
  });

  it("is «nothingDue» on a day with nothing due", () => {
    expect(todayState([], TODAY)).toBe("nothingDue");
    expect(todayState([makeTask({ dueDate: "2026-09-29", status: "done" })], TODAY)).toBe(
      "nothingDue",
    );
  });

  it("is «nothingDue» while overdue tasks are left, even after completing today's", () => {
    const tasks = [
      makeTask({ dueDate: TODAY, status: "done" }),
      makeTask({ dueDate: "2026-09-29" }),
    ];
    expect(todayState(tasks, TODAY)).toBe("nothingDue");
  });
});

describe("nextDueTask (D68)", () => {
  it("is the earliest open task due after today, Hoch first on the same day", () => {
    const tasks = [
      makeTask({ title: "Später", dueDate: "2026-10-10" }),
      makeTask({ title: "Samstag tief", dueDate: "2026-10-03" }),
      makeTask({ title: "Samstag hoch", dueDate: "2026-10-03", priority: "high" }),
      makeTask({ title: "Erledigt", dueDate: "2026-10-01", status: "done" }),
      makeTask({ title: "Heute", dueDate: TODAY }),
      makeTask({ title: "Ohne Datum" }),
    ];
    expect(nextDueTask(tasks, TODAY)?.title).toBe("Samstag hoch");
  });

  it("is null without a later task", () => {
    expect(nextDueTask([makeTask({ dueDate: TODAY })], TODAY)).toBeNull();
  });
});

describe("lastCompleted (DSH-06)", () => {
  it("returns the last five completions, newest first, without a time window", () => {
    const done = (title: string, iso: string, extra = {}) =>
      makeTask({
        title,
        status: "done",
        completedAt: new Date(iso),
        completedBy: "anna",
        ...extra,
      });
    const tasks = [
      done("Alt", "2025-01-01T10:00:00Z"),
      done("Bad", "2026-09-26T09:00:00Z", { seriesId: "s1", seriesIndex: 1 }),
      done("Bett", "2026-09-29T17:02:00Z"),
      done("Altpapier", "2026-09-28T06:00:00Z"),
      done("Küche", "2026-09-30T06:11:00Z"),
      done("Fenster", "2026-09-27T12:00:00Z"),
      makeTask({ title: "Offen", dueDate: TODAY }),
      makeTask({ title: "Ohne Zeit", status: "done" }),
    ];
    expect(titles(lastCompleted(tasks))).toEqual(["Küche", "Bett", "Altpapier", "Fenster", "Bad"]);
    expect(titles(lastCompleted(tasks, 2))).toEqual(["Küche", "Bett"]);
  });
});

describe("shoppingPreview (DSH-05)", () => {
  it("shows the first five open items in Einkauf order and counts all open ones", () => {
    const items = [
      makeItem({ name: "Glühbirnen", category: "other" }),
      makeItem({ name: "Milch" }),
      makeItem({ name: "Tabs", category: "household" }),
      makeItem({ name: "Ibuprofen", category: "pharmacy" }),
      makeItem({ name: "Kaffee" }),
      makeItem({ name: "Bananen" }),
      makeItem({ name: "Brot", checked: true }),
    ];
    const preview = shoppingPreview(items);
    expect(preview.items.map((item) => item.name)).toEqual([
      "Milch",
      "Kaffee",
      "Bananen",
      "Tabs",
      "Ibuprofen",
    ]);
    expect(preview.openCount).toBe(6);
  });

  it("is empty when everything is bought", () => {
    expect(shoppingPreview([makeItem({ checked: true })])).toEqual({ items: [], openCount: 0 });
  });
});

describe("upcomingWeek (DSH-04)", () => {
  const everyOtherSat: RecurrenceRule = { freq: "weekly", interval: 2, byWeekday: [6] };

  it("shows the next occurrence of a series (acceptance criterion «Recurring event»)", () => {
    const cleaning = makeEvent({
      title: "Grossputz",
      start: new Date("2026-09-19T08:00:00Z"),
      end: new Date("2026-09-19T10:00:00Z"),
      recurrence: everyOtherSat,
    });
    const rows = upcomingWeek([cleaning], NOW, ZURICH, 1);
    expect(rows.map((row) => [row.dayKey, row.occurrence.event.title])).toEqual([
      ["2026-10-03", "Grossputz"],
    ]);
    expect(rows[0].occurrence.key).toBe(`${cleaning.id}@2026-10-03`);
  });

  it("covers today … today + 6, leaves out what's over, puts a running trip on today", () => {
    const ended = makeEvent({
      title: "Vorbei",
      start: new Date("2026-09-30T04:00:00Z"),
      end: new Date("2026-09-30T05:12:00Z"),
    });
    const trip = makeEvent({
      title: "Ferien",
      allDay: true,
      category: "travel",
      ...allDayToStored("2026-09-28", "2026-10-02"),
    });
    const lastDay = makeEvent({
      title: "Arzttermin",
      start: new Date("2026-10-06T06:15:00Z"),
      end: new Date("2026-10-06T07:00:00Z"),
    });
    const tooLate = makeEvent({
      title: "Zu spät",
      ...allDayToStored("2026-10-07", "2026-10-07"),
      allDay: true,
    });
    const party = makeEvent({ title: "Znacht" });
    const rows = upcomingWeek([ended, trip, lastDay, tooLate, party], NOW, ZURICH, 1);
    expect(rows.map((row) => [row.dayKey, row.occurrence.event.title])).toEqual([
      ["2026-09-30", "Ferien"],
      ["2026-10-02", "Znacht"],
      ["2026-10-06", "Arzttermin"],
    ]);
  });
});
