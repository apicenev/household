import { describe, expect, it } from "vitest";
import type { RecurrenceRule } from "../types";
import {
  addDaysToKey,
  daysBetweenKeys,
  daysInMonth,
  startOfWeekKey,
  weekdayOfKey,
} from "./dateKeys";
import {
  defaultUntil,
  eventPickerFromRule,
  eventRuleFromPicker,
  firstDueOnOrAfter,
  matchesRule,
  MAX_OCCURRENCES,
  nextDueDate,
  nextOccurrence,
  nthWeekdayOfMonth,
  occurrenceDates,
  pickerFromRule,
  ruleForSave,
  ruleFromPicker,
  sameRule,
  seriesRange,
  setPosOf,
  snapToSchedule,
  validateEventRule,
  validateRule,
  withDueDate,
  withStartDate,
  type EventPickerState,
  type PickerState,
} from "./recurrence";

// 2026: Thu 1 Oct, Sat 3 Oct, Sun 4 Oct. DST ends on Sun 25 Oct, starts on Sun 29 Mar.
const daily = (interval = 1): RecurrenceRule => ({ freq: "daily", interval });
const weekly = (byWeekday: number[], interval = 1): RecurrenceRule => ({
  freq: "weekly",
  interval,
  byWeekday,
});
const monthly = (byMonthDay: number): RecurrenceRule => ({
  freq: "monthly",
  interval: 1,
  byMonthDay,
});
const yearly = (byMonth: number, byMonthDay: number): RecurrenceRule => ({
  freq: "yearly",
  interval: 1,
  byMonth,
  byMonthDay,
});

describe("dateKeys", () => {
  it("knows weekdays, week starts and month lengths", () => {
    expect(weekdayOfKey("2026-10-03")).toBe(6);
    expect(startOfWeekKey("2026-10-03", 1)).toBe("2026-09-28");
    expect(startOfWeekKey("2026-10-03", 0)).toBe("2026-09-27");
    expect(startOfWeekKey("2026-10-04", 0)).toBe("2026-10-04");
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(addDaysToKey("2026-12-30", 4)).toBe("2027-01-03");
  });
});

describe("validateRule", () => {
  it("accepts every frequency tasks offer", () => {
    for (const rule of [
      daily(),
      daily(4),
      weekly([6]),
      weekly([1, 4], 2),
      monthly(31),
      yearly(2, 29),
    ]) {
      expect(validateRule(rule)).toEqual({ ok: true });
    }
  });

  it("rejects bad intervals, weekdays, days, months and stray keys", () => {
    expect(validateRule(daily(0))).toEqual({ ok: false, problem: "interval" });
    expect(validateRule(daily(53))).toEqual({ ok: false, problem: "interval" });
    expect(validateRule(daily(1.5))).toEqual({ ok: false, problem: "interval" });
    expect(validateRule(weekly([]))).toEqual({ ok: false, problem: "weekdays" });
    expect(validateRule(weekly([7]))).toEqual({ ok: false, problem: "weekdays" });
    expect(validateRule(weekly([1, 1]))).toEqual({ ok: false, problem: "weekdays" });
    expect(validateRule(monthly(0))).toEqual({ ok: false, problem: "monthDay" });
    expect(validateRule({ freq: "monthly", interval: 2, byMonthDay: 3 })).toEqual({
      ok: false,
      problem: "interval",
    });
    expect(validateRule(yearly(13, 1))).toEqual({ ok: false, problem: "month" });
    expect(validateRule({ freq: "daily", interval: 1, byWeekday: [1] })).toEqual({
      ok: false,
      problem: "keys",
    });
  });
});

describe("nextDueDate: acceptance criteria (requirements §9)", () => {
  it("«Bad putzen», weekly on Saturday, due Sat 3 Oct, done Sun 4 Oct → Sat 10 Oct", () => {
    expect(nextDueDate(weekly([6]), "2026-10-03", "2026-10-04", 1)).toBe("2026-10-10");
  });

  it("«Pflanzen giessen», every 4 days, due 1 Oct, done 10 Oct → 13 Oct, not 14 Oct", () => {
    expect(nextDueDate(daily(4), "2026-10-01", "2026-10-10", 1)).toBe("2026-10-13");
  });
});

describe("nextDueDate (B1)", () => {
  it("completion on the due date gives the next schedule date", () => {
    expect(nextDueDate(daily(), "2026-10-03", "2026-10-03", 1)).toBe("2026-10-04");
    expect(nextDueDate(weekly([6]), "2026-10-03", "2026-10-03", 1)).toBe("2026-10-10");
  });

  it("completion before the due date doesn't shift the schedule", () => {
    expect(nextDueDate(weekly([6]), "2026-10-10", "2026-10-08", 1)).toBe("2026-10-17");
    expect(nextDueDate(daily(4), "2026-10-13", "2026-10-02", 1)).toBe("2026-10-17");
    expect(nextDueDate(monthly(3), "2026-11-03", "2026-10-20", 1)).toBe("2026-12-03");
  });

  it("a late completion can land on today", () => {
    expect(nextDueDate(daily(4), "2026-10-01", "2026-10-13", 1)).toBe("2026-10-13");
    expect(nextDueDate(weekly([6]), "2026-09-26", "2026-10-10", 1)).toBe("2026-10-10");
  });

  it("skips weeks and months that passed", () => {
    expect(nextDueDate(monthly(3), "2026-10-03", "2027-01-10", 1)).toBe("2027-02-03");
    expect(nextDueDate(yearly(10, 3), "2024-10-03", "2026-10-04", 1)).toBe("2027-10-03");
  });

  it("every 3 weeks, completed months late: on schedule, ≥ today, the first such date", () => {
    const rule = weekly([6], 3);
    const anchor = "2026-01-03";
    const today = "2026-10-10";
    const next = nextDueDate(rule, anchor, today, 1);
    expect(next >= today).toBe(true);
    expect(weekdayOfKey(next)).toBe(6);
    expect(daysBetweenKeys(anchor, next) % 21).toBe(0);
    expect(addDaysToKey(next, -21) < today).toBe(true);
  });
});

describe("nextOccurrence: daily and every N days", () => {
  it("counts days from the anchor across month and year ends", () => {
    expect(nextOccurrence(daily(4), "2026-12-30", "2026-12-30", 1)).toBe("2027-01-03");
    expect(nextOccurrence(daily(), "2028-02-28", "2028-02-28", 1)).toBe("2028-02-29");
    expect(nextOccurrence(daily(), "2026-02-28", "2026-02-28", 1)).toBe("2026-03-01");
  });

  it("returns the anchor for dates before it", () => {
    expect(nextOccurrence(daily(4), "2026-09-20", "2026-10-01", 1)).toBe("2026-10-01");
  });

  it("isn't moved by DST", () => {
    expect(nextOccurrence(daily(), "2026-03-28", "2026-03-28", 1)).toBe("2026-03-29");
    expect(nextOccurrence(daily(), "2026-03-29", "2026-03-28", 1)).toBe("2026-03-30");
    expect(nextOccurrence(daily(), "2026-10-25", "2026-10-25", 1)).toBe("2026-10-26");
  });
});

describe("nextOccurrence: weekly and every N weeks", () => {
  it("finds the next selected weekday", () => {
    expect(nextOccurrence(weekly([6]), "2026-10-03", "2026-10-03", 1)).toBe("2026-10-10");
    expect(nextOccurrence(weekly([1, 4]), "2026-10-05", "2026-10-05", 1)).toBe("2026-10-08");
    expect(nextOccurrence(weekly([1, 4]), "2026-10-08", "2026-10-05", 1)).toBe("2026-10-12");
    expect(nextOccurrence(weekly([0, 1, 2, 3, 4, 5, 6]), "2026-10-03", "2026-10-03", 1)).toBe(
      "2026-10-04",
    );
  });

  it("works across the DST change", () => {
    expect(nextOccurrence(weekly([6]), "2026-10-24", "2026-10-24", 1)).toBe("2026-10-31");
    expect(nextOccurrence(weekly([0]), "2026-03-22", "2026-03-22", 1)).toBe("2026-03-29");
  });

  it("every 2 weeks with two weekdays stays in the anchor's week grid", () => {
    const rule = weekly([1, 4], 2);
    expect(nextOccurrence(rule, "2026-10-05", "2026-10-05", 1)).toBe("2026-10-08");
    expect(nextOccurrence(rule, "2026-10-08", "2026-10-05", 1)).toBe("2026-10-19");
  });

  it("every 2 weeks counts weeks from the due date's week (B6: the first step can be short)", () => {
    const rule = weekly([0], 2);
    // Due Sat 10 Oct: with Monday week start, Sun 11 Oct is in the same week.
    expect(nextDueDate(rule, "2026-10-10", "2026-10-10", 1)).toBe("2026-10-11");
    expect(nextDueDate(rule, "2026-10-11", "2026-10-11", 1)).toBe("2026-10-25");
    // With Sunday week start, Sun 11 Oct starts the next week, so the next one is 18 Oct.
    expect(nextDueDate(rule, "2026-10-10", "2026-10-10", 0)).toBe("2026-10-18");
  });

  it("an anchor that isn't on a selected weekday uses the next selected day in its week", () => {
    // Due Wed 7 Oct, weekly on Saturday → Sat 10 Oct.
    expect(nextOccurrence(weekly([6]), "2026-10-07", "2026-10-07", 1)).toBe("2026-10-10");
    expect(nextOccurrence(weekly([6]), "2026-10-01", "2026-10-07", 1)).toBe("2026-10-10");
  });

  it("throws for a rule without weekdays instead of looping forever", () => {
    expect(() => nextOccurrence(weekly([]), "2026-10-03", "2026-10-03", 1)).toThrow();
  });
});

describe("nextOccurrence: monthly", () => {
  it("falls back to the last day of shorter months and returns to the 31st", () => {
    const rule = monthly(31);
    expect(nextOccurrence(rule, "2026-10-31", "2026-10-31", 1)).toBe("2026-11-30");
    expect(nextOccurrence(rule, "2026-11-30", "2026-11-30", 1)).toBe("2026-12-31");
    expect(nextOccurrence(rule, "2027-01-31", "2027-01-31", 1)).toBe("2027-02-28");
    expect(nextOccurrence(rule, "2027-02-28", "2027-02-28", 1)).toBe("2027-03-31");
    expect(nextOccurrence(rule, "2028-01-31", "2028-01-31", 1)).toBe("2028-02-29");
    expect(nextOccurrence(monthly(30), "2026-01-30", "2026-01-30", 1)).toBe("2026-02-28");
  });

  it("an anchor after the day of the month starts with the next month", () => {
    expect(nextOccurrence(monthly(3), "2026-10-15", "2026-10-15", 1)).toBe("2026-11-03");
    expect(nextOccurrence(monthly(20), "2026-10-15", "2026-10-15", 1)).toBe("2026-10-20");
  });
});

describe("nextOccurrence: yearly", () => {
  it("keeps 29 Feb in leap years and uses 28 Feb otherwise", () => {
    const rule = yearly(2, 29);
    expect(nextOccurrence(rule, "2028-02-29", "2028-02-29", 1)).toBe("2029-02-28");
    expect(nextOccurrence(rule, "2029-02-28", "2029-02-28", 1)).toBe("2030-02-28");
    expect(nextOccurrence(rule, "2031-02-28", "2031-02-28", 1)).toBe("2032-02-29");
    expect(nextOccurrence(yearly(10, 3), "2026-10-03", "2026-10-03", 1)).toBe("2027-10-03");
    expect(nextOccurrence(yearly(10, 3), "2026-09-01", "2026-09-01", 1)).toBe("2026-10-03");
  });
});

describe("matchesRule / firstDueOnOrAfter", () => {
  it("tells whether a date is on the schedule", () => {
    expect(matchesRule(weekly([6]), "2026-10-10", "2026-10-03", 1)).toBe(true);
    expect(matchesRule(weekly([6]), "2026-10-11", "2026-10-03", 1)).toBe(false);
    expect(matchesRule(daily(4), "2026-10-09", "2026-10-01", 1)).toBe(true);
    expect(matchesRule(daily(4), "2026-10-10", "2026-10-01", 1)).toBe(false);
  });

  it("D26: the first matching date from today", () => {
    const wednesday = "2026-10-07";
    expect(firstDueOnOrAfter(daily(4), wednesday, 1)).toBe(wednesday);
    expect(firstDueOnOrAfter(weekly([6]), wednesday, 1)).toBe("2026-10-10");
    expect(firstDueOnOrAfter(weekly([3]), wednesday, 1)).toBe(wednesday);
    expect(firstDueOnOrAfter(monthly(3), wednesday, 1)).toBe("2026-11-03");
    expect(firstDueOnOrAfter(monthly(7), wednesday, 1)).toBe(wednesday);
  });
});

describe("picker ⇄ rule (B2)", () => {
  const due = "2026-10-03"; // Saturday
  const state = (overrides: Partial<PickerState>): PickerState => ({
    freq: "none",
    n: 2,
    weekdays: [6],
    ...overrides,
  });

  it("maps every chip to its rule", () => {
    expect(ruleFromPicker(state({ freq: "none" }), due)).toBeNull();
    expect(ruleFromPicker(state({ freq: "daily" }), due)).toEqual(daily());
    expect(ruleFromPicker(state({ freq: "ndays", n: 4 }), due)).toEqual(daily(4));
    expect(ruleFromPicker(state({ freq: "weekly", weekdays: [4, 1] }), due)).toEqual(
      weekly([1, 4]),
    );
    expect(ruleFromPicker(state({ freq: "nweeks", n: 3, weekdays: [0] }), due)).toEqual(
      weekly([0], 3),
    );
    expect(ruleFromPicker(state({ freq: "monthly" }), due)).toEqual(monthly(3));
    expect(ruleFromPicker(state({ freq: "yearly" }), due)).toEqual(yearly(10, 3));
  });

  it("uses the due date's weekday when none is selected and clamps N to 2–52", () => {
    expect(ruleFromPicker(state({ freq: "weekly", weekdays: [] }), due)).toEqual(weekly([6]));
    expect(ruleFromPicker(state({ freq: "ndays", n: 1 }), due)).toEqual(daily(2));
    expect(ruleFromPicker(state({ freq: "ndays", n: 99 }), due)).toEqual(daily(52));
  });

  it("reads a stored rule back into the picker", () => {
    expect(pickerFromRule(undefined, due)).toEqual({ freq: "none", n: 2, weekdays: [6] });
    expect(pickerFromRule(undefined, null)).toEqual({ freq: "none", n: 2, weekdays: [] });
    expect(pickerFromRule(daily(), due).freq).toBe("daily");
    expect(pickerFromRule(daily(4), due)).toEqual({ freq: "ndays", n: 4, weekdays: [6] });
    expect(pickerFromRule(weekly([4, 1]), due)).toEqual({ freq: "weekly", n: 2, weekdays: [1, 4] });
    expect(pickerFromRule(weekly([0], 3), due)).toEqual({ freq: "nweeks", n: 3, weekdays: [0] });
    expect(pickerFromRule(monthly(3), due).freq).toBe("monthly");
    expect(pickerFromRule(yearly(10, 3), due).freq).toBe("yearly");
  });

  it("round trips", () => {
    for (const rule of [
      daily(),
      daily(4),
      weekly([1, 4]),
      weekly([0], 3),
      monthly(3),
      yearly(10, 3),
    ]) {
      expect(ruleFromPicker(pickerFromRule(rule, due), due)).toEqual(rule);
    }
  });
});

describe("withDueDate (B6) / sameRule", () => {
  it("monthly and yearly follow a new due date, other rules stay", () => {
    expect(withDueDate(monthly(31), "2026-11-03")).toEqual(monthly(3));
    expect(withDueDate(yearly(10, 3), "2027-02-14")).toEqual(yearly(2, 14));
    expect(withDueDate(weekly([6]), "2026-10-07")).toEqual(weekly([6]));
    expect(withDueDate(daily(4), "2026-10-07")).toEqual(daily(4));
  });

  it("compares schedules, ignoring weekday order", () => {
    expect(sameRule(weekly([4, 1]), weekly([1, 4]))).toBe(true);
    expect(sameRule(weekly([1]), weekly([1], 2))).toBe(false);
    expect(sameRule(monthly(3), monthly(4))).toBe(false);
    expect(sameRule(undefined, undefined)).toBe(true);
    expect(sameRule(daily(), undefined)).toBe(false);
  });
});

describe("ruleForSave (B6)", () => {
  const state: PickerState = { freq: "monthly", n: 2, weekdays: [] };

  it("keeps the stored day and month while the due date is unchanged", () => {
    expect(ruleForSave(state, "2027-02-28", { rule: monthly(31), dueDate: "2027-02-28" })).toEqual(
      monthly(31),
    );
    expect(
      ruleForSave({ ...state, freq: "yearly" }, "2029-02-28", {
        rule: yearly(2, 29),
        dueDate: "2029-02-28",
      }),
    ).toEqual(yearly(2, 29));
  });

  it("follows a changed due date or a new frequency", () => {
    expect(ruleForSave(state, "2027-03-03", { rule: monthly(31), dueDate: "2027-02-28" })).toEqual(
      monthly(3),
    );
    expect(ruleForSave(state, "2027-02-28", { rule: daily(), dueDate: "2027-02-28" })).toEqual(
      monthly(28),
    );
    expect(ruleForSave(state, "2027-02-28")).toEqual(monthly(28));
    expect(
      ruleForSave({ ...state, freq: "none" }, "2027-02-28", {
        rule: monthly(31),
        dueDate: "2027-02-28",
      }),
    ).toBeNull();
  });
});

// Phase 7: recurring events (B1, B3, B5, B6, D59, D60).
const lastSat: RecurrenceRule = { freq: "monthly", interval: 1, byWeekday: [6], bySetPos: -1 };
const firstSat: RecurrenceRule = { freq: "monthly", interval: 1, byWeekday: [6], bySetPos: 1 };
const everyOtherSat = weekly([6], 2);

describe("validateEventRule (Phase 7 B1)", () => {
  it("accepts the task shapes, monthly by weekday and one end condition", () => {
    for (const rule of [
      daily(),
      weekly([2, 6]),
      monthly(31),
      yearly(2, 29),
      firstSat,
      lastSat,
      { ...everyOtherSat, until: "2026-12-31" },
      { ...firstSat, count: 2 },
      { ...daily(4), count: 99 },
    ]) {
      expect(validateEventRule(rule)).toEqual({ ok: true });
    }
  });

  it("rejects both ends, bad ends and bad weekday positions", () => {
    const problem = (rule: RecurrenceRule) => {
      const result = validateEventRule(rule);
      return result.ok ? null : result.problem;
    };
    expect(problem({ ...daily(), until: "2026-12-31", count: 3 })).toBe("end");
    expect(problem({ ...daily(), until: "31.12.2026" })).toBe("until");
    expect(problem({ ...daily(), until: "2026-02-30" })).toBe("until");
    expect(problem({ ...daily(), count: 1 })).toBe("count");
    expect(problem({ ...daily(), count: 100 })).toBe("count");
    expect(problem({ ...daily(), count: 2.5 })).toBe("count");
    expect(problem({ ...firstSat, byMonthDay: 3 })).toBe("keys");
    expect(problem({ ...firstSat, bySetPos: 5 })).toBe("setPos");
    expect(problem({ ...firstSat, bySetPos: 0 })).toBe("setPos");
    expect(problem({ ...firstSat, byWeekday: [1, 6] })).toBe("weekdays");
    expect(problem({ ...firstSat, interval: 2 })).toBe("interval");
    expect(problem({ ...yearly(10, 3), bySetPos: 1 })).toBe("keys");
  });

  it("tasks keep rejecting bySetPos, until and count", () => {
    for (const rule of [firstSat, { ...daily(), until: "2026-12-31" }, { ...daily(), count: 3 }]) {
      expect(validateRule(rule)).toEqual({ ok: false, problem: "keys" });
    }
  });
});

describe("nextOccurrence: weekly never before the anchor (Phase 7 review)", () => {
  // Thu 1 Oct 2026 with «Di, Sa»: Tue 29 Sept lies in the anchor's week, before the anchor.
  const rule = weekly([2, 6]);

  it("starts at the anchor, not at its week start", () => {
    expect(nextOccurrence(rule, "2026-09-27", "2026-10-01", 1)).toBe("2026-10-03");
    expect(nextOccurrence(rule, "2026-09-26", "2026-10-01", 0)).toBe("2026-10-03");
    expect(occurrenceDates(rule, "2026-10-01", "2026-09-28", "2026-10-10", 1)).toEqual([
      "2026-10-03",
      "2026-10-06",
      "2026-10-10",
    ]);
  });

  it("keeps the task behaviour (after ≥ anchor − 1)", () => {
    expect(nextDueDate(weekly([6]), "2026-10-03", "2026-10-04", 1)).toBe("2026-10-10");
    expect(firstDueOnOrAfter(rule, "2026-10-01", 1)).toBe("2026-10-03");
  });
});

describe("monthly by weekday (D60)", () => {
  it("finds the nth and the last weekday of a month", () => {
    expect(nthWeekdayOfMonth(2026, 10, 6, 1)).toBe("2026-10-03");
    expect(nthWeekdayOfMonth(2026, 11, 6, 1)).toBe("2026-11-07");
    expect(nthWeekdayOfMonth(2026, 10, 2, 4)).toBe("2026-10-27");
    expect(nthWeekdayOfMonth(2026, 10, 6, -1)).toBe("2026-10-31");
    expect(nthWeekdayOfMonth(2027, 2, 6, -1)).toBe("2027-02-27");
  });

  it("derives the position from a date; the 5th is the last", () => {
    const days = [1, 7, 8, 21, 22, 28, 29, 31];
    expect(days.map((d) => setPosOf(`2026-10-${String(d).padStart(2, "0")}`))).toEqual([
      1, 1, 2, 3, 4, 4, -1, -1,
    ]);
  });

  it("expands «1. Samstag» and «letzter Samstag»", () => {
    expect(occurrenceDates(firstSat, "2026-10-03", "2026-10-01", "2026-12-31", 1)).toEqual([
      "2026-10-03",
      "2026-11-07",
      "2026-12-05",
    ]);
    expect(occurrenceDates(lastSat, "2026-10-31", "2026-10-01", "2027-02-28", 1)).toEqual([
      "2026-10-31",
      "2026-11-28",
      "2026-12-26",
      "2027-01-30",
      "2027-02-27",
    ]);
  });
});

describe("occurrenceDates (REV-03, REV-05, B5, B6)", () => {
  it("acceptance criterion: every 2 weeks on Saturday from 3 Oct → 3, 17, 31 Oct", () => {
    const october = (anchor: string) =>
      occurrenceDates(everyOtherSat, anchor, "2026-10-01", "2026-10-31", 1);
    expect(october("2026-10-03")).toEqual(["2026-10-03", "2026-10-17", "2026-10-31"]);
    expect(october("2026-09-19")).toEqual(["2026-10-03", "2026-10-17", "2026-10-31"]);
  });

  it("falls back to the last day of shorter months (REV-05)", () => {
    expect(occurrenceDates(monthly(31), "2026-01-31", "2026-01-01", "2026-04-30", 1)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
    expect(occurrenceDates(monthly(31), "2028-01-31", "2028-02-01", "2028-02-29", 1)).toEqual([
      "2028-02-29",
    ]);
  });

  it("yearly on 29 Feb: 28 Feb in non-leap years, 29 Feb in leap years (B5)", () => {
    expect(occurrenceDates(yearly(2, 29), "2028-02-29", "2028-01-01", "2030-12-31", 1)).toEqual([
      "2028-02-29",
      "2029-02-28",
      "2030-02-28",
    ]);
    expect(occurrenceDates(yearly(2, 29), "2024-02-29", "2027-01-01", "2028-12-31", 1)).toEqual([
      "2027-02-28",
      "2028-02-29",
    ]);
  });

  it("ends on the `until` date, inclusive", () => {
    const until = (key: string) =>
      occurrenceDates({ ...weekly([6]), until: key }, "2026-10-03", "2026-10-01", "2026-12-31", 1);
    expect(until("2026-10-17")).toEqual(["2026-10-03", "2026-10-10", "2026-10-17"]);
    expect(until("2026-10-16")).toEqual(["2026-10-03", "2026-10-10"]);
  });

  it("counts from the first occurrence, past ones included", () => {
    const rule = { ...weekly([6]), count: 3 };
    expect(occurrenceDates(rule, "2026-10-03", "2026-10-10", "2026-12-31", 1)).toEqual([
      "2026-10-10",
      "2026-10-17",
    ]);
  });

  it("jumps into the range of an old series", () => {
    const dates = occurrenceDates(daily(), "2020-01-01", "2026-10-01", "2026-10-31", 1);
    expect(dates).toHaveLength(31);
    expect(dates[0]).toBe("2026-10-01");
    // 600 fortnights before 3 Oct 2026 is a Saturday on the same schedule.
    const oldAnchor = addDaysToKey("2026-10-03", -14 * 600);
    expect(occurrenceDates(everyOtherSat, oldAnchor, "2026-10-01", "2026-10-31", 1)).toEqual([
      "2026-10-03",
      "2026-10-17",
      "2026-10-31",
    ]);
  });

  it("is capped (§8.6)", () => {
    expect(occurrenceDates(daily(), "2026-01-01", "2026-01-01", "2028-12-31", 1)).toHaveLength(
      MAX_OCCURRENCES,
    );
    expect(occurrenceDates(daily(), "2026-01-01", "2026-01-01", "2028-12-31", 1, 3)).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
    ]);
  });

  it("is empty before the anchor and after the end", () => {
    expect(occurrenceDates(weekly([6]), "2026-10-03", "2026-09-01", "2026-09-30", 1)).toEqual([]);
    expect(
      occurrenceDates({ ...weekly([6]), count: 2 }, "2026-10-03", "2026-11-01", "2026-11-30", 1),
    ).toEqual([]);
  });
});

describe("snapToSchedule / seriesRange (B3, D63)", () => {
  it("moves an off-schedule start to the first occurrence", () => {
    expect(snapToSchedule(weekly([6]), "2026-10-01", 1)).toBe("2026-10-03");
    expect(snapToSchedule(weekly([6]), "2026-10-03", 1)).toBe("2026-10-03");
    expect(snapToSchedule(everyOtherSat, "2026-10-01", 1)).toBe("2026-10-03");
    expect(snapToSchedule(firstSat, "2026-10-04", 1)).toBe("2026-11-07");
  });

  it("knows the first and last occurrence", () => {
    expect(seriesRange(everyOtherSat, "2026-09-19", 1)).toEqual({
      first: "2026-09-19",
      last: null,
    });
    expect(seriesRange({ ...everyOtherSat, count: 4 }, "2026-09-19", 1)).toEqual({
      first: "2026-09-19",
      last: "2026-10-31",
    });
    expect(seriesRange({ ...weekly([6]), until: "2026-12-31" }, "2026-10-03", 1)).toEqual({
      first: "2026-10-03",
      last: "2026-12-26",
    });
    expect(seriesRange({ ...yearly(10, 3), until: "2030-01-01" }, "2026-10-03", 1)).toEqual({
      first: "2026-10-03",
      last: "2029-10-03",
    });
  });

  it("is null for a series without occurrences", () => {
    expect(seriesRange({ ...weekly([6]), until: "2026-10-02" }, "2026-10-01", 1)).toBeNull();
  });
});

describe("withStartDate / sameRule for events (B10)", () => {
  it("re-derives weekday and position, never adding byMonthDay", () => {
    expect(withStartDate({ ...firstSat, count: 5 }, "2026-10-31")).toEqual({
      ...lastSat,
      count: 5,
    });
    expect(withStartDate(firstSat, "2026-10-13")).toEqual({
      freq: "monthly",
      interval: 1,
      byWeekday: [2],
      bySetPos: 2,
    });
    expect(withStartDate({ ...monthly(3), until: "2026-12-31" }, "2026-10-14")).toEqual({
      ...monthly(14),
      until: "2026-12-31",
    });
    expect(withStartDate(yearly(10, 3), "2027-02-28")).toEqual(yearly(2, 28));
    expect(withStartDate(weekly([6]), "2026-10-14")).toEqual(weekly([6]));
  });

  it("sees changes of bySetPos, until and count", () => {
    expect(sameRule(firstSat, lastSat)).toBe(false);
    expect(sameRule(weekly([6]), { ...weekly([6]), until: "2026-12-31" })).toBe(false);
    expect(sameRule({ ...weekly([6]), count: 3 }, { ...weekly([6]), count: 4 })).toBe(false);
    expect(sameRule({ ...weekly([6]), count: 3 }, { ...weekly([6]), count: 3 })).toBe(true);
  });
});

describe("event picker (B2, D59, D60)", () => {
  it("defaults: «Nie», until three months later, 10 times", () => {
    expect(defaultUntil("2026-09-19")).toBe("2026-12-31");
    expect(defaultUntil("2026-11-15")).toBe("2027-02-28");
    expect(eventPickerFromRule(undefined, "2026-09-19")).toEqual({
      freq: "none",
      n: 2,
      weekdays: [6],
      monthlyMode: "day",
      end: "never",
      until: "2026-12-31",
      count: 10,
    });
  });

  it("reads stored rules", () => {
    expect(eventPickerFromRule({ ...firstSat, count: 4 }, "2026-10-03")).toMatchObject({
      freq: "monthly",
      monthlyMode: "weekday",
      end: "after",
      count: 4,
    });
    expect(
      eventPickerFromRule({ ...everyOtherSat, until: "2027-01-31" }, "2026-10-03"),
    ).toMatchObject({ freq: "nweeks", n: 2, weekdays: [6], end: "date", until: "2027-01-31" });
  });

  it("builds rules from the start date", () => {
    const state = (patch: Partial<EventPickerState>): EventPickerState => ({
      ...eventPickerFromRule(undefined, "2026-10-03"),
      ...patch,
    });
    expect(eventRuleFromPicker(state({}), "2026-10-03")).toBeNull();
    expect(eventRuleFromPicker(state({ freq: "monthly" }), "2026-10-03")).toEqual(monthly(3));
    expect(
      eventRuleFromPicker(state({ freq: "monthly", monthlyMode: "weekday" }), "2026-10-03"),
    ).toEqual(firstSat);
    expect(
      eventRuleFromPicker(state({ freq: "monthly", monthlyMode: "weekday" }), "2026-10-31"),
    ).toEqual(lastSat);
    expect(eventRuleFromPicker(state({ freq: "yearly", end: "date" }), "2026-10-03")).toEqual({
      ...yearly(10, 3),
      until: "2027-01-31",
    });
    expect(
      eventRuleFromPicker(state({ freq: "nweeks", end: "after", count: 150 }), "2026-10-03"),
    ).toEqual({ ...everyOtherSat, count: 99 });
    expect(
      eventRuleFromPicker(state({ freq: "daily", end: "after", count: 1 }), "2026-10-03"),
    ).toEqual({ ...daily(), count: 2 });
  });

  it("round-trips every stored shape", () => {
    for (const rule of [
      daily(4),
      weekly([1, 4]),
      { ...everyOtherSat, until: "2026-12-31" },
      monthly(3),
      { ...firstSat, count: 3 },
      yearly(10, 3),
    ]) {
      expect(eventRuleFromPicker(eventPickerFromRule(rule, "2026-10-03"), "2026-10-03")).toEqual(
        rule,
      );
    }
  });
});
