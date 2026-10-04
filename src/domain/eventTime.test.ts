import { describe, expect, it } from "vitest";
import { formatDate, fromDateKey } from "../lib/format";
import {
  DAY_MS,
  allDayKeys,
  allDayToStored,
  dayBounds,
  defaultTimes,
  instantToZoned,
  moveEndKeyWithStart,
  moveEndWithStart,
  validateEventTimes,
  zonedToInstant,
} from "./eventTime";

const ZURICH = "Europe/Zurich";
const NEW_YORK = "America/New_York";
const TOKYO = "Asia/Tokyo";

describe("all-day dates (B2)", () => {
  it("stores the first and last day at 00:00 UTC and reads them back", () => {
    const stored = allDayToStored("2026-10-14", "2026-10-21");
    expect(stored.start.toISOString()).toBe("2026-10-14T00:00:00.000Z");
    expect(stored.end.toISOString()).toBe("2026-10-21T00:00:00.000Z");
    expect(allDayKeys(stored)).toEqual({ startKey: "2026-10-14", endKey: "2026-10-21" });
  });

  it("a one-day event has start == end", () => {
    const stored = allDayToStored("2026-10-01", "2026-10-01");
    expect(stored.start.getTime()).toBe(stored.end.getTime());
  });

  it.each([ZURICH, NEW_YORK, TOKYO])("the keys don't depend on the zone (%s)", (zone) => {
    const stored = allDayToStored("2026-10-14", "2026-10-21");
    const { startKey, endKey } = allDayKeys(stored);
    // Shown via the key, the label is the stored day in every zone …
    expect(formatDate(fromDateKey(startKey), zone)).toBe("Mi., 14. Okt.");
    expect(formatDate(fromDateKey(endKey), zone)).toBe("Mi., 21. Okt.");
  });

  it("formatting the stored Date in New York would show the day before (the trap B2 avoids)", () => {
    const stored = allDayToStored("2026-10-14", "2026-10-14");
    expect(formatDate(stored.start, NEW_YORK)).toBe("Di., 13. Okt.");
  });
});

describe("zonedToInstant / instantToZoned", () => {
  it("converts a local time in Zurich (summer and winter)", () => {
    expect(zonedToInstant("2026-10-02", "19:30", ZURICH).toISOString()).toBe(
      "2026-10-02T17:30:00.000Z",
    );
    expect(zonedToInstant("2026-11-02", "19:30", ZURICH).toISOString()).toBe(
      "2026-11-02T18:30:00.000Z",
    );
  });

  it("uses the household zone, not the device's", () => {
    expect(zonedToInstant("2026-10-02", "19:30", NEW_YORK).toISOString()).toBe(
      "2026-10-02T23:30:00.000Z",
    );
    expect(instantToZoned(new Date("2026-10-02T23:30:00Z"), ZURICH)).toEqual({
      dateKey: "2026-10-03",
      time: "01:30",
    });
  });

  it("moves a time in the spring gap forward (29 Mar 2026, 02:30 → 03:30)", () => {
    const instant = zonedToInstant("2026-03-29", "02:30", ZURICH);
    expect(instantToZoned(instant, ZURICH)).toEqual({ dateKey: "2026-03-29", time: "03:30" });
  });

  it("round-trips local times", () => {
    const instant = zonedToInstant("2026-10-25", "01:30", ZURICH);
    expect(instantToZoned(instant, ZURICH)).toEqual({ dateKey: "2026-10-25", time: "01:30" });
  });
});

describe("dayBounds", () => {
  it("is 24 h on a normal day", () => {
    const { start, end } = dayBounds("2026-10-02", ZURICH);
    expect(start.toISOString()).toBe("2026-10-01T22:00:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(DAY_MS);
  });

  it("is 25 h on 25 Oct 2026 and 23 h on 29 Mar 2026 (DST)", () => {
    const autumn = dayBounds("2026-10-25", ZURICH);
    expect(autumn.end.getTime() - autumn.start.getTime()).toBe(25 * 60 * 60 * 1000);
    const spring = dayBounds("2026-03-29", ZURICH);
    expect(spring.end.getTime() - spring.start.getTime()).toBe(23 * 60 * 60 * 1000);
  });

  it("an event 01:30–03:30 on 25 Oct lasts 3 h and stays on that day", () => {
    const start = zonedToInstant("2026-10-25", "01:30", ZURICH);
    const end = zonedToInstant("2026-10-25", "03:30", ZURICH);
    expect(end.getTime() - start.getTime()).toBe(3 * 60 * 60 * 1000);
    const { start: dayStart, end: dayEnd } = dayBounds("2026-10-25", ZURICH);
    expect(start >= dayStart && end <= dayEnd).toBe(true);
  });
});

describe("defaultTimes (B6)", () => {
  const at = (iso: string) => new Date(iso);

  it.each([
    ["14:10", "2026-09-30T12:10:00Z", "15:00", "16:00"],
    ["14:00", "2026-09-30T12:00:00Z", "15:00", "16:00"],
    ["22:59", "2026-09-30T20:59:00Z", "23:00", "00:00"],
  ])("today at %s → next full hour", (_label, now, startTime, endTime) => {
    const times = defaultTimes("2026-09-30", at(now), ZURICH);
    expect(times.startKey).toBe("2026-09-30");
    expect(times.startTime).toBe(startTime);
    expect(times.endTime).toBe(endTime);
  });

  it("an event ending at midnight ends on the next day", () => {
    const times = defaultTimes("2026-09-30", at("2026-09-30T20:59:00Z"), ZURICH);
    expect(times.endKey).toBe("2026-10-01");
  });

  it("today from 23:00 on → tomorrow 09:00–10:00", () => {
    expect(defaultTimes("2026-09-30", at("2026-09-30T21:30:00Z"), ZURICH)).toEqual({
      startKey: "2026-10-01",
      startTime: "09:00",
      endKey: "2026-10-01",
      endTime: "10:00",
    });
  });

  it.each(["2026-10-14", "2026-09-01"])("any other day (%s) → 09:00–10:00", (day) => {
    expect(defaultTimes(day, at("2026-09-30T12:10:00Z"), ZURICH)).toEqual({
      startKey: day,
      startTime: "09:00",
      endKey: day,
      endTime: "10:00",
    });
  });

  it("uses today of the household zone", () => {
    // 01:10 in Zurich on 1 Oct is still 30 Sept in New York.
    const times = defaultTimes("2026-09-30", at("2026-09-30T23:10:00Z"), NEW_YORK);
    expect(times).toMatchObject({ startKey: "2026-09-30", startTime: "20:00" });
  });
});

describe("moving the end with the start (B6)", () => {
  it("keeps the duration of a timed event", () => {
    const start = new Date("2026-10-02T17:30:00Z");
    const end = new Date("2026-10-02T20:30:00Z");
    const moved = moveEndWithStart(start, end, new Date("2026-10-03T08:00:00Z"));
    expect(moved.toISOString()).toBe("2026-10-03T11:00:00.000Z");
  });

  it("keeps the length of an all-day event", () => {
    expect(moveEndKeyWithStart("2026-10-14", "2026-10-21", "2026-10-30")).toBe("2026-11-06");
  });
});

describe("validateEventTimes (B3)", () => {
  const timed = (startIso: string, endIso: string) => ({
    allDay: false,
    start: new Date(startIso),
    end: new Date(endIso),
  });
  const allDay = (startKey: string, endKey: string) => ({
    allDay: true,
    ...allDayToStored(startKey, endKey),
  });

  it("accepts an end equal to or after the start", () => {
    expect(validateEventTimes(timed("2026-10-02T17:30:00Z", "2026-10-02T17:30:00Z"))).toBeNull();
    expect(validateEventTimes(timed("2026-10-02T17:30:00Z", "2026-10-02T20:30:00Z"))).toBeNull();
    expect(validateEventTimes(allDay("2026-10-01", "2026-10-01"))).toBeNull();
  });

  it("rejects an end before the start", () => {
    expect(validateEventTimes(timed("2026-10-02T17:30:00Z", "2026-10-02T17:00:00Z"))).toBe(
      "endBeforeStart",
    );
    expect(validateEventTimes(allDay("2026-10-02", "2026-10-01"))).toBe("endBeforeStart");
  });

  it("allows exactly 366 days and rejects 367, for timed and all-day events", () => {
    expect(validateEventTimes(timed("2026-01-01T00:00:00Z", "2027-01-02T00:00:00Z"))).toBeNull();
    expect(validateEventTimes(timed("2026-01-01T00:00:00Z", "2027-01-02T00:00:01Z"))).toBe(
      "tooLong",
    );
    // 1 Jan 2026 … 1 Jan 2027 = 366 calendar days; … 2 Jan 2027 = 367.
    expect(validateEventTimes(allDay("2026-01-01", "2027-01-01"))).toBeNull();
    expect(validateEventTimes(allDay("2026-01-01", "2027-01-02"))).toBe("tooLong");
  });

  it("rejects all-day times that aren't at 00:00 UTC", () => {
    expect(
      validateEventTimes({
        allDay: true,
        start: new Date("2026-10-01T22:00:00Z"),
        end: new Date("2026-10-01T22:00:00Z"),
      }),
    ).toBe("notMidnight");
  });
});
