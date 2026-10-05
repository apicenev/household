import { describe, expect, it } from "vitest";
import type { RecurrenceRule } from "../types";
import {
  completionNote,
  describeRule,
  describeRuleEnd,
  describeRuleInSentence,
  describeSeriesEnd,
  nextDuePhrase,
  rotationLabel,
  rotationPreview,
  weekdayPlural,
  weekdaysInOrder,
} from "./recurrenceFormat";
import { taskCopy } from "./copy";

const names: Record<string, string> = { nevio: "Nevio", anna: "Anna", mia: "Mia" };
const nameOf = (uid: string) => names[uid];

describe("describeRule (B10)", () => {
  const cases: Array<[RecurrenceRule, string, string]> = [
    [{ freq: "daily", interval: 1 }, "Täglich", "Täglich"],
    [{ freq: "daily", interval: 4 }, "Alle 4 Tage", "Alle 4 Tage"],
    [{ freq: "weekly", interval: 1, byWeekday: [6] }, "Jeden Samstag", "Wöchentlich"],
    [
      { freq: "weekly", interval: 1, byWeekday: [4, 1] },
      "Wöchentlich am Montag, Donnerstag",
      "Wöchentlich",
    ],
    [{ freq: "weekly", interval: 2, byWeekday: [0] }, "Alle 2 Wochen · Sonntag", "Alle 2 Wochen"],
    [{ freq: "monthly", interval: 1, byMonthDay: 3 }, "Monatlich am 3.", "Monatlich"],
    [
      { freq: "yearly", interval: 1, byMonth: 10, byMonthDay: 3 },
      "Jährlich am 3. Oktober",
      "Jährlich",
    ],
  ];

  it.each(cases)("%j → «%s» / «%s»", (rule, full, short) => {
    expect(describeRule(rule)).toBe(full);
    expect(describeRule(rule, { short: true })).toBe(short);
  });

  it("lists weekdays in the household's week order (D32)", () => {
    const rule: RecurrenceRule = { freq: "weekly", interval: 1, byWeekday: [0, 1] };
    expect(describeRule(rule, { weekStartsOn: 1 })).toBe("Wöchentlich am Montag, Sonntag");
    expect(describeRule(rule, { weekStartsOn: 0 })).toBe("Wöchentlich am Sonntag, Montag");
    expect(weekdaysInOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(weekdaysInOrder(0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("rotationLabel", () => {
  it("starts with the current assignee and leaves out former members", () => {
    expect(rotationLabel({ memberIds: ["nevio", "anna"], index: 0 }, nameOf)).toBe("Nevio → Anna");
    expect(rotationLabel({ memberIds: ["nevio", "anna", "mia"], index: 2 }, nameOf)).toBe(
      "Mia → Nevio → Anna",
    );
    expect(rotationLabel({ memberIds: ["nevio", "lea", "anna"], index: 0 }, nameOf)).toBe(
      "Nevio → Anna",
    );
  });
});

describe("completion note (D29)", () => {
  const today = "2026-10-10";

  it("names the next due date in lowercase", () => {
    expect(nextDuePhrase("2026-10-10", today)).toBe("heute");
    expect(nextDuePhrase("2026-10-11", today)).toBe("morgen");
    expect(nextDuePhrase("2026-10-13", today)).toBe("am Di., 13. Okt.");
  });

  it("names the next assignee with rotation, otherwise the date", () => {
    expect(
      completionNote({ dueDate: "2026-10-17", assigneeName: "Anna", rotates: true }, today),
    ).toBe("als Nächstes ist Anna dran");
    expect(completionNote({ dueDate: "2026-10-13", rotates: false }, today)).toBe(
      "nächstes Mal am Di., 13. Okt.",
    );
    expect(completionNote({ dueDate: "2026-10-10", rotates: false }, today)).toBe(
      "nächstes Mal heute",
    );
  });
});

describe("rotationPreview (D28)", () => {
  const today = "2026-09-30"; // Wednesday
  const next = { dueDate: "2026-10-10", name: "Anna" };

  it("«Diesen Samstag» later this week", () => {
    expect(rotationPreview({ dueDate: "2026-10-03", name: "Nevio" }, next, today, 1)).toBe(
      "Diesen Samstag Nevio, danach Anna am Sa., 10. Okt.",
    );
  });

  it("«Heute» / «Morgen» / «Diesmal»", () => {
    expect(rotationPreview({ dueDate: today, name: "Nevio" }, next, today, 1)).toBe(
      "Heute Nevio, danach Anna am Sa., 10. Okt.",
    );
    expect(rotationPreview({ dueDate: "2026-10-01", name: "Nevio" }, next, today, 1)).toBe(
      "Morgen Nevio, danach Anna am Sa., 10. Okt.",
    );
    expect(rotationPreview({ dueDate: "2026-09-26", name: "Nevio" }, next, today, 1)).toMatch(
      /^Diesmal Nevio/,
    );
    // Sun 4 Oct is next week when weeks start on Sunday.
    expect(rotationPreview({ dueDate: "2026-10-04", name: "Nevio" }, next, today, 0)).toMatch(
      /^Diesmal Nevio/,
    );
    expect(rotationPreview({ dueDate: "2026-10-04", name: "Nevio" }, next, today, 1)).toMatch(
      /^Diesen Sonntag Nevio/,
    );
  });
});

describe("series delete dialog texts (B8)", () => {
  it("puts the rule into a sentence", () => {
    expect(describeRuleInSentence({ freq: "weekly", interval: 1, byWeekday: [6] })).toBe(
      "jeden Samstag",
    );
    expect(describeRuleInSentence({ freq: "daily", interval: 4 })).toBe("alle 4 Tage");
    expect(describeRuleInSentence({ freq: "weekly", interval: 2, byWeekday: [0] })).toBe(
      "alle 2 Wochen am Sonntag",
    );
    expect(describeRuleInSentence({ freq: "monthly", interval: 1, byMonthDay: 3 })).toBe(
      "monatlich am 3.",
    );
  });

  it("names the weekday in plural only for a single weekday", () => {
    expect(weekdayPlural({ freq: "weekly", interval: 1, byWeekday: [6] })).toBe("Samstage");
    expect(weekdayPlural({ freq: "weekly", interval: 2, byWeekday: [3] })).toBe("Mittwoche");
    expect(weekdayPlural({ freq: "weekly", interval: 1, byWeekday: [1, 4] })).toBeUndefined();
    expect(weekdayPlural({ freq: "daily", interval: 4 })).toBeUndefined();
  });

  it("doesn't double the period after an abbreviated month", () => {
    expect(taskCopy.series.oneHint("Sa., 3. Okt.")).toBe("Nur Sa., 3. Okt. Die nächste bleibt.");
    expect(taskCopy.series.oneHint("Fr., 1. Mai")).toBe("Nur Fr., 1. Mai. Die nächste bleibt.");
  });
});

describe("event rules (Phase 7 D60, D63)", () => {
  const firstSat: RecurrenceRule = { freq: "monthly", interval: 1, byWeekday: [6], bySetPos: 1 };
  const everyOtherSat: RecurrenceRule = { freq: "weekly", interval: 2, byWeekday: [6] };

  it("describes monthly by weekday", () => {
    expect(describeRule(firstSat)).toBe("Monatlich am 1. Samstag");
    expect(describeRule({ ...firstSat, bySetPos: -1 })).toBe("Monatlich am letzten Samstag");
    expect(describeRule({ ...firstSat, byWeekday: [2], bySetPos: 2 })).toBe(
      "Monatlich am 2. Dienstag",
    );
    expect(describeRule(firstSat, { short: true })).toBe("Monatlich");
  });

  it("describes the end for the picker summary", () => {
    expect(describeRuleEnd(everyOtherSat)).toBeUndefined();
    expect(describeRuleEnd({ ...everyOtherSat, until: "2026-12-31" })).toBe("bis 31. Dez. 2026");
    expect(describeRuleEnd({ ...everyOtherSat, count: 10 })).toBe("10 Mal");
  });

  it("describes the series in the Termin-Detail", () => {
    const since = { first: "2026-09-19", last: null };
    expect(describeSeriesEnd(everyOtherSat, since, "2026-09-30")).toBe(
      "Seit Sa., 19. Sept. · endet nie",
    );
    expect(
      describeSeriesEnd(
        { ...everyOtherSat, until: "2026-12-31" },
        { first: "2026-09-19", last: "2026-12-26" },
        "2026-09-30",
      ),
    ).toBe("Seit Sa., 19. Sept. · endet am Do., 31. Dez. 2026");
    expect(
      describeSeriesEnd(
        { ...everyOtherSat, count: 10 },
        { first: "2026-09-19", last: "2027-01-23" },
        "2026-09-30",
      ),
    ).toBe("Seit Sa., 19. Sept. · endet nach 10 Terminen");
    expect(
      describeSeriesEnd(
        { ...everyOtherSat, count: 2 },
        { first: "2026-08-29", last: "2026-09-12" },
        "2026-09-30",
      ),
    ).toBe("Endete am Sa., 12. Sept.");
    // The last occurrence today isn't over yet.
    expect(
      describeSeriesEnd(
        { ...everyOtherSat, count: 2 },
        { first: "2026-09-16", last: "2026-09-30" },
        "2026-09-30",
      ),
    ).toBe("Seit Mi., 16. Sept. · endet nach 2 Terminen");
  });
});
