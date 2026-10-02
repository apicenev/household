import { describe, expect, it } from "vitest";
import {
  calendarDaysFrom,
  completedLabel,
  dueLabel,
  formatDate,
  formatLongDate,
  formatNumber,
  formatNumericDate,
  formatTime,
  formatTimeRange,
  quickPickDates,
  relativeDay,
} from "./format";

// All instants are given in UTC; Europe/Zurich is UTC+2 in summer, UTC+1 in winter.
const utc = (iso: string) => new Date(iso);

describe("formatDate", () => {
  it("formats as «Sa., 3. Okt.»", () => {
    expect(formatDate(utc("2026-10-03T08:00:00Z"))).toBe("Sa., 3. Okt.");
  });

  it("uses «Sept.» for September, as in the design", () => {
    expect(formatDate(utc("2026-09-26T08:00:00Z"))).toBe("Sa., 26. Sept.");
  });

  it("uses the local day just after midnight", () => {
    // 22:30 UTC on 2 Oct = 00:30 on 3 Oct in Zurich
    expect(formatDate(utc("2026-10-02T22:30:00Z"))).toBe("Sa., 3. Okt.");
    expect(formatDate(utc("2026-10-02T22:30:00Z"), "UTC")).toBe("Fr., 2. Okt.");
  });

  it("never contains «ß»", () => {
    const months = Array.from({ length: 12 }, (_, m) => new Date(Date.UTC(2026, m, 15, 12)));
    for (const d of months) {
      expect(formatDate(d)).not.toContain("ß");
      expect(formatLongDate(d)).not.toContain("ß");
    }
  });
});

describe("formatLongDate / formatNumericDate", () => {
  it("formats «Mittwoch, 30. September»", () => {
    expect(formatLongDate(utc("2026-09-30T10:00:00Z"))).toBe("Mittwoch, 30. September");
  });

  it("formats «03.10.2026»", () => {
    expect(formatNumericDate(utc("2026-10-03T10:00:00Z"))).toBe("03.10.2026");
  });

  it("handles the year boundary in the local time zone", () => {
    // 23:30 UTC on 31 Dec = 00:30 on 1 Jan in Zurich
    expect(formatNumericDate(utc("2026-12-31T23:30:00Z"))).toBe("01.01.2027");
    expect(formatLongDate(utc("2026-12-31T23:30:00Z"))).toBe("Freitag, 1. Januar");
  });
});

describe("relativeDay", () => {
  const today = utc("2026-09-30T10:00:00Z"); // Wednesday

  it("returns Heute / Morgen / Gestern", () => {
    expect(relativeDay(utc("2026-09-30T21:00:00Z"), today)).toBe("Heute");
    expect(relativeDay(utc("2026-10-01T06:00:00Z"), today)).toBe("Morgen");
    expect(relativeDay(utc("2026-09-29T06:00:00Z"), today)).toBe("Gestern");
  });

  it("returns the weekday within the coming week", () => {
    expect(relativeDay(utc("2026-10-03T08:00:00Z"), today)).toBe("Sa.");
    expect(relativeDay(utc("2026-10-06T08:00:00Z"), today)).toBe("Di.");
  });

  it("returns the date from one week ahead and further back than yesterday", () => {
    expect(relativeDay(utc("2026-10-07T08:00:00Z"), today)).toBe("Mi., 7. Okt.");
    expect(relativeDay(utc("2026-09-28T08:00:00Z"), today)).toBe("Mo., 28. Sept.");
  });

  it("counts local calendar days around midnight", () => {
    const lateEvening = utc("2026-09-30T21:59:00Z"); // 23:59 Wednesday in Zurich
    expect(relativeDay(utc("2026-09-30T22:01:00Z"), lateEvening)).toBe("Morgen"); // 00:01 Thursday
  });

  it("counts one day across the DST changes", () => {
    // Spring forward: Sun 29 Mar 2026 has 23 hours in Zurich
    expect(calendarDaysFrom(utc("2026-03-29T22:30:00Z"), utc("2026-03-28T23:30:00Z"))).toBe(1);
    expect(relativeDay(utc("2026-03-29T22:30:00Z"), utc("2026-03-29T10:00:00Z"))).toBe("Morgen");
    // Fall back: Sun 25 Oct 2026 has 25 hours in Zurich
    // 00:00 Sun (CEST) → 00:30 Mon (CET) is 24.5 h but one calendar day
    expect(calendarDaysFrom(utc("2026-10-25T23:30:00Z"), utc("2026-10-24T22:00:00Z"))).toBe(1);
    expect(relativeDay(utc("2026-10-25T22:59:00Z"), utc("2026-10-25T00:30:00Z"))).toBe("Heute");
  });
});

describe("formatTime / formatTimeRange", () => {
  it("formats 24-hour local time", () => {
    expect(formatTime(utc("2026-10-03T08:00:00Z"))).toBe("10:00");
    expect(formatTime(utc("2026-12-03T08:00:00Z"))).toBe("09:00"); // winter time
    expect(formatTime(utc("2026-10-02T22:05:00Z"))).toBe("00:05");
  });

  it("joins a range with an en dash", () => {
    expect(formatTimeRange(utc("2026-10-03T08:00:00Z"), utc("2026-10-03T10:00:00Z"))).toBe(
      "10:00–12:00",
    );
  });
});

describe("formatNumber", () => {
  it("uses the Swiss apostrophe grouping and a decimal point", () => {
    expect(formatNumber(1250.5, 2)).toBe("1'250.50");
    expect(formatNumber(1250.5)).toBe("1'250.5");
    expect(formatNumber(1234567)).toBe("1'234'567");
    expect(formatNumber(12)).toBe("12");
  });
});

describe("quickPickDates", () => {
  const keys = (today: Date) => quickPickDates(today).map((pick) => [pick.label, pick.key]);

  it("returns today, tomorrow and the coming Saturday", () => {
    expect(keys(utc("2026-09-30T10:00:00Z"))).toEqual([
      ["Heute", "2026-09-30"],
      ["Morgen", "2026-10-01"],
      ["Sa.", "2026-10-03"],
    ]);
  });

  it("skips to next week's Saturday on Friday and Saturday", () => {
    expect(keys(utc("2026-10-02T10:00:00Z"))[2]).toEqual(["Sa.", "2026-10-10"]);
    expect(keys(utc("2026-10-03T10:00:00Z"))[2]).toEqual(["Sa.", "2026-10-10"]);
  });

  it("uses the local day just after midnight", () => {
    // 23:30 UTC on Fri 2 Oct = 01:30 Sat 3 Oct in Zurich
    expect(keys(utc("2026-10-02T23:30:00Z"))[0]).toEqual(["Heute", "2026-10-03"]);
  });
});

describe("dueLabel", () => {
  it("is relative around today, otherwise the date (B11)", () => {
    expect(dueLabel("2026-09-29", "2026-09-30")).toBe("Gestern");
    expect(dueLabel("2026-09-30", "2026-09-30")).toBe("Heute");
    expect(dueLabel("2026-10-01", "2026-09-30")).toBe("Morgen");
    expect(dueLabel("2026-10-03", "2026-09-30")).toBe("Sa., 3. Okt.");
    expect(dueLabel("2026-09-28", "2026-09-30")).toBe("Mo., 28. Sept.");
    expect(dueLabel(null, "2026-09-30")).toBe("Ohne Datum");
  });

  it("works across the DST change and month ends", () => {
    expect(dueLabel("2026-10-26", "2026-10-25")).toBe("Morgen");
    expect(dueLabel("2026-10-31", "2026-11-01")).toBe("Gestern");
  });
});

describe("completedLabel", () => {
  const now = utc("2026-09-30T10:00:00Z");

  it("«gerade eben», «Heute», «Gestern», otherwise the date", () => {
    expect(completedLabel(utc("2026-09-30T09:59:30Z"), now)).toBe("gerade eben");
    expect(completedLabel(utc("2026-09-30T06:00:00Z"), now)).toBe("Heute");
    expect(completedLabel(utc("2026-09-29T20:00:00Z"), now)).toBe("Gestern");
    expect(completedLabel(utc("2026-09-28T10:00:00Z"), now)).toBe("Mo., 28. Sept.");
  });

  it("uses the calendar day of the household time zone", () => {
    // 22:30 UTC on 29 Sept is already 30 Sept in Zurich.
    expect(completedLabel(utc("2026-09-29T22:30:00Z"), now)).toBe("Heute");
  });
});
