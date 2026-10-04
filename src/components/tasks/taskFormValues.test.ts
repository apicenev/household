import { describe, expect, it } from "vitest";
import { makeMember, makeTask } from "../../tests/householdFakes";
import {
  initialTaskFormValues,
  taskInputFromValues,
  withAssignee,
  withDueDate,
  withRepeat,
  withRotationOrder,
  withRotationSwitch,
  type TaskFormValues,
} from "./taskFormValues";

const TODAY = "2026-09-30"; // Wednesday
const nevio = makeMember({ uid: "nevio", displayName: "Nevio", joinedAt: new Date("2026-09-14") });
const anna = makeMember({ uid: "anna", displayName: "Anna", joinedAt: new Date("2026-09-20") });
const mia = makeMember({ uid: "mia", displayName: "Mia", joinedAt: new Date("2026-09-25") });
const members = [anna, nevio];
const weeklySat = { freq: "weekly" as const, interval: 1, byWeekday: [6] };

const blank = (overrides: Partial<TaskFormValues> = {}): TaskFormValues => ({
  ...initialTaskFormValues(undefined),
  title: "Bad putzen",
  ...overrides,
});

describe("withRepeat (D26, D27)", () => {
  it("fills a missing due date with the first matching date", () => {
    expect(withRepeat(blank(), { freq: "weekly", n: 2, weekdays: [6] }, TODAY, 1)).toMatchObject({
      dueDate: "2026-10-03",
    });
    expect(withRepeat(blank(), { freq: "ndays", n: 4, weekdays: [] }, TODAY, 1)).toMatchObject({
      dueDate: TODAY,
    });
  });

  it("keeps an existing due date", () => {
    const patch = withRepeat(
      blank({ dueDate: "2026-10-10" }),
      { freq: "daily", n: 2, weekdays: [] },
      TODAY,
      1,
    );
    expect(patch).not.toHaveProperty("dueDate");
  });

  it("«Nie» turns the rotation off", () => {
    const values = blank({ rotation: ["nevio", "anna"] });
    expect(withRepeat(values, { freq: "none", n: 2, weekdays: [] }, TODAY, 1)).toMatchObject({
      rotation: null,
      rotationTouched: true,
    });
  });
});

describe("rotation in the form (B4, B11)", () => {
  it("the switch starts with the household order (or by joinedAt) at the assignee", () => {
    expect(withRotationSwitch(blank(), true, undefined, members)).toEqual({
      rotation: ["nevio", "anna"],
      assigneeId: "nevio",
      rotationTouched: true,
    });
    expect(
      withRotationSwitch(blank({ assigneeId: "anna" }), true, ["nevio", "anna"], members),
    ).toEqual({
      rotation: ["anna", "nevio"],
      assigneeId: "anna",
      rotationTouched: true,
    });
    expect(withRotationSwitch(blank(), false, undefined, members)).toEqual({
      rotation: null,
      rotationTouched: true,
    });
  });

  it("«Zuständig» rotates the order; «Niemand» turns it off", () => {
    const values = blank({ rotation: ["nevio", "anna", "mia"], assigneeId: "nevio" });
    expect(withAssignee(values, "mia")).toEqual({
      assigneeId: "mia",
      rotation: ["mia", "nevio", "anna"],
      rotationTouched: true,
    });
    expect(withAssignee(values, null)).toEqual({
      assigneeId: null,
      rotation: null,
      rotationTouched: true,
    });
    expect(withAssignee(blank(), "anna")).toEqual({ assigneeId: "anna" });
  });

  it("moving someone to the top makes them the assignee", () => {
    expect(withRotationOrder(["anna", "nevio"])).toEqual({
      rotation: ["anna", "nevio"],
      assigneeId: "anna",
      rotationTouched: true,
    });
  });

  it("an edited rotation shows new members at the end, former ones gone", () => {
    const task = makeTask({
      recurrence: weeklySat,
      dueDate: "2026-10-03",
      assigneeId: "anna",
      rotation: { memberIds: ["lea", "nevio", "anna"], index: 2 },
    });
    expect(initialTaskFormValues(task, {}, [anna, nevio, mia]).rotation).toEqual([
      "anna",
      "nevio",
      "mia",
    ]);
  });
});

describe("withDueDate", () => {
  it("can't clear the date of a recurring task (RTK-02)", () => {
    expect(
      withDueDate(blank({ repeat: { freq: "daily", n: 2, weekdays: [] }, dueDate: TODAY }), ""),
    ).toEqual({});
    expect(withDueDate(blank({ dueDate: TODAY }), "")).toEqual({ dueDate: "" });
  });
});

describe("taskInputFromValues", () => {
  it("builds the rule and rotation of a new task", () => {
    const values = blank({
      dueDate: "2026-10-03",
      assigneeId: "anna",
      repeat: { freq: "weekly", n: 2, weekdays: [6] },
      rotation: ["anna", "nevio"],
      rotationTouched: true,
    });
    expect(taskInputFromValues(values, "Bad putzen")).toEqual({
      title: "Bad putzen",
      assigneeId: "anna",
      dueDate: "2026-10-03",
      priority: "low",
      recurrence: weeklySat,
      rotation: { memberIds: ["anna", "nevio"], index: 0 },
    });
  });

  it("keeps an untouched rotation as stored, even when a member joined since (B4)", () => {
    const stored = { memberIds: ["nevio", "anna"], index: 1 };
    const task = makeTask({
      recurrence: weeklySat,
      dueDate: "2026-10-03",
      assigneeId: "anna",
      rotation: stored,
    });
    const values = initialTaskFormValues(task, {}, [anna, nevio, mia]);
    expect(values.rotation).toEqual(["anna", "nevio", "mia"]);
    expect(taskInputFromValues(values, task.title, task).rotation).toBe(stored);
  });

  it("monthly keeps «am 31.» unless the due date changed (B6)", () => {
    const task = makeTask({
      recurrence: { freq: "monthly", interval: 1, byMonthDay: 31 },
      dueDate: "2026-11-30",
    });
    const values = initialTaskFormValues(task, {}, members);
    expect(taskInputFromValues(values, "Miete", task).recurrence).toEqual({
      freq: "monthly",
      interval: 1,
      byMonthDay: 31,
    });
    expect(
      taskInputFromValues({ ...values, dueDate: "2026-12-03" }, "Miete", task).recurrence,
    ).toEqual({
      freq: "monthly",
      interval: 1,
      byMonthDay: 3,
    });
  });

  it("«Nie» saves no rule and no rotation", () => {
    const values = blank({ dueDate: TODAY, rotation: ["nevio", "anna"] });
    const input = taskInputFromValues(values, "Bad");
    expect(input).not.toHaveProperty("recurrence");
    expect(input).not.toHaveProperty("rotation");
  });
});
