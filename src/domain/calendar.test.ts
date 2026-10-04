import { describe, expect, it } from "vitest";
import type { CalendarEvent, EventCategory, EventOccurrence, Member } from "../types";
import {
  addMonths,
  allDayLength,
  barLane,
  compareOccurrences,
  dayDots,
  dayTime,
  eventsOnDay,
  isMultiDayAllDay,
  monthGrid,
  normalizeParticipants,
  occurrenceDays,
  occurrencesInRange,
  parseDayParam,
  parseMonthParam,
  parseViewParam,
  spanInfo,
  upcoming,
  visibleParticipants,
} from "./calendar";
import { allDayToStored, zonedToInstant } from "./eventTime";

const ZURICH = "Europe/Zurich";

let seq = 0;

function event(overrides: Partial<CalendarEvent>): CalendarEvent {
  seq += 1;
  return {
    id: `e${seq}`,
    title: `Termin ${seq}`,
    category: "other",
    allDay: false,
    start: new Date("2026-10-02T17:30:00Z"),
    end: new Date("2026-10-02T20:30:00Z"),
    participants: "household",
    createdBy: "nevio",
    createdAt: new Date("2026-09-01T10:00:00Z"),
    updatedAt: new Date("2026-09-01T10:00:00Z"),
    hasPendingWrites: false,
    ...overrides,
  };
}

/** Timed event from local Zurich times. */
function timed(
  day: string,
  from: string,
  to: string,
  overrides: Partial<CalendarEvent> = {},
  toDay = day,
) {
  return event({
    start: zonedToInstant(day, from, ZURICH),
    end: zonedToInstant(toDay, to, ZURICH),
    ...overrides,
  });
}

function allDay(first: string, last: string, overrides: Partial<CalendarEvent> = {}) {
  return event({ allDay: true, ...allDayToStored(first, last), ...overrides });
}

function occ(e: CalendarEvent): EventOccurrence {
  return { key: e.id, event: e, start: e.start, end: e.end };
}

function member(uid: string): Member {
  return {
    uid,
    displayName: uid,
    initials: uid.slice(0, 2).toUpperCase(),
    avatarColor: 1,
    role: "member",
    joinedAt: new Date("2026-09-01T10:00:00Z"),
  };
}

describe("monthGrid (CAL-01, B7)", () => {
  it("October 2026 from Monday: 5 weeks, 28 Sept – 1 Nov", () => {
    const weeks = monthGrid("2026-10", 1, "2026-09-30");
    expect(weeks).toHaveLength(5);
    expect(weeks[0][0]).toEqual({ key: "2026-09-28", day: 28, inMonth: false, isToday: false });
    expect(weeks[0][2]).toMatchObject({ key: "2026-09-30", isToday: true, inMonth: false });
    expect(weeks[0][3]).toMatchObject({ key: "2026-10-01", day: 1, inMonth: true });
    expect(weeks[4][6]).toMatchObject({ key: "2026-11-01", inMonth: false });
  });

  it("February 2026 from Sunday: exactly 4 weeks", () => {
    const weeks = monthGrid("2026-02", 0, "2026-02-10");
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0].key).toBe("2026-02-01");
    expect(weeks[3][6].key).toBe("2026-02-28");
    expect(weeks.flat().every((d) => d.inMonth)).toBe(true);
  });

  it("August 2026 from Monday: 6 weeks", () => {
    const weeks = monthGrid("2026-08", 1, "2026-09-30");
    expect(weeks).toHaveLength(6);
    expect(weeks[0][0].key).toBe("2026-07-27");
    expect(weeks[5][6].key).toBe("2026-09-06");
  });

  it("starts the weeks on the household's week start", () => {
    expect(monthGrid("2026-10", 0, "2026-09-30")[0][0].key).toBe("2026-09-27");
  });
});

describe("URL parameters (B8)", () => {
  it("parses the month or falls back to today's", () => {
    expect(parseMonthParam("2026-11", "2026-09-30")).toBe("2026-11");
    expect(parseMonthParam("foo", "2026-09-30")).toBe("2026-09");
    expect(parseMonthParam("2026-13", "2026-09-30")).toBe("2026-09");
    expect(parseMonthParam(null, "2026-09-30")).toBe("2026-09");
  });

  it("accepts only real days", () => {
    expect(parseDayParam("2026-10-14")).toBe("2026-10-14");
    expect(parseDayParam("2026-02-31")).toBeNull();
    expect(parseDayParam("14.10.2026")).toBeNull();
    expect(parseDayParam(null)).toBeNull();
  });

  it("parses the view", () => {
    expect(parseViewParam("upcoming")).toBe("upcoming");
    expect(parseViewParam("month")).toBe("month");
    expect(parseViewParam(null)).toBe("month");
  });

  it("shifts months across years", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-10", 0)).toBe("2026-10");
  });
});

describe("occurrenceDays (B4, D55)", () => {
  it("a timed event crossing midnight touches two days", () => {
    const late = timed("2026-10-02", "22:00", "02:00", {}, "2026-10-03");
    expect(occurrenceDays(occ(late), ZURICH)).toEqual({
      startKey: "2026-10-02",
      endKey: "2026-10-03",
    });
  });

  it("an event ending exactly at 00:00 stays on its day", () => {
    const toMidnight = timed("2026-10-02", "22:00", "00:00", {}, "2026-10-03");
    expect(occurrenceDays(occ(toMidnight), ZURICH)).toEqual({
      startKey: "2026-10-02",
      endKey: "2026-10-02",
    });
  });

  it("a zero-length event belongs to its start day", () => {
    const reminder = timed("2026-10-02", "00:00", "00:00");
    expect(occurrenceDays(occ(reminder), ZURICH)).toEqual({
      startKey: "2026-10-02",
      endKey: "2026-10-02",
    });
  });

  it("all-day events use their stored days in any zone", () => {
    const trip = allDay("2026-10-14", "2026-10-21");
    expect(occurrenceDays(occ(trip), "America/New_York")).toEqual({
      startKey: "2026-10-14",
      endKey: "2026-10-21",
    });
  });
});

describe("occurrencesInRange (B11, key range)", () => {
  const trip = allDay("2026-10-30", "2026-11-02");
  const endsAtRangeStart = timed("2026-10-31", "22:00", "00:00", {}, "2026-11-01");
  const dinner = timed("2026-10-02", "19:30", "22:30");

  it("includes all-day events touching the first or last key", () => {
    const keys = (first: string, last: string) =>
      occurrencesInRange([trip], first, last, ZURICH).map((o) => o.key);
    expect(keys("2026-11-02", "2026-11-30")).toEqual([trip.id]);
    expect(keys("2026-10-01", "2026-10-30")).toEqual([trip.id]);
    expect(keys("2026-11-03", "2026-11-30")).toEqual([]);
  });

  it("leaves out a timed event that ends at the range start", () => {
    expect(occurrencesInRange([endsAtRangeStart], "2026-11-01", "2026-11-30", ZURICH)).toEqual([]);
  });

  it("returns one occurrence per event, keyed by its id", () => {
    const result = occurrencesInRange([dinner], "2026-10-01", "2026-10-31", ZURICH);
    expect(result).toEqual([
      { key: dinner.id, event: dinner, start: dinner.start, end: dinner.end },
    ]);
  });
});

describe("eventsOnDay and order (CAL-02, B4)", () => {
  it("lists multi-day events across a month boundary on each day", () => {
    const trip = allDay("2026-10-30", "2026-11-02");
    for (const day of ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]) {
      expect(eventsOnDay([occ(trip)], day, ZURICH)).toHaveLength(1);
    }
    expect(eventsOnDay([occ(trip)], "2026-11-03", ZURICH)).toHaveLength(0);
  });

  it("orders all-day (multi-day first), then timed by start, end and title", () => {
    const single = allDay("2026-10-14", "2026-10-14", { title: "Möbel" });
    const trip = allDay("2026-10-10", "2026-10-21", { title: "Ferien" });
    const morning = timed("2026-10-14", "08:15", "09:00", { title: "Arzt" });
    const morningLong = timed("2026-10-14", "08:15", "10:00", { title: "Arzt lang" });
    const sameTimeB = timed("2026-10-14", "19:00", "20:00", { title: "Znacht" });
    const sameTimeA = timed("2026-10-14", "19:00", "20:00", { title: "Apéro" });
    const titles = eventsOnDay(
      [sameTimeB, morningLong, single, sameTimeA, morning, trip].map(occ),
      "2026-10-14",
      ZURICH,
    ).map((o) => o.event.title);
    expect(titles).toEqual(["Ferien", "Möbel", "Arzt", "Arzt lang", "Apéro", "Znacht"]);
  });

  it("ties fall back to the key", () => {
    const a = timed("2026-10-14", "19:00", "20:00", { title: "Gleich" });
    const b = { ...occ(a), key: `${a.id}-b` };
    expect(compareOccurrences(occ(a), b)).toBeLessThan(0);
  });
});

describe("dayDots (B7, D54)", () => {
  const cat = (category: EventCategory) => occ(timed("2026-10-14", "10:00", "11:00", { category }));

  it("shows up to 3 distinct categories in order", () => {
    const dots = dayDots([cat("home"), cat("home"), cat("social"), cat("reminder"), cat("other")]);
    expect(dots).toEqual(["home", "social", "reminder"]);
  });

  it("leaves out only the bar's own event: a second trip keeps its dot", () => {
    const tripA = occ(allDay("2026-10-14", "2026-10-21", { category: "travel" }));
    const tripB = occ(allDay("2026-10-16", "2026-10-18", { category: "travel" }));
    expect(dayDots([tripA], tripA.key)).toEqual([]);
    expect(dayDots([tripA, tripB], tripA.key)).toEqual(["travel"]);
  });
});

describe("barLane (D54)", () => {
  const weeks = monthGrid("2026-10", 1, "2026-09-30");

  it("draws «Ferien» 14–21 Oct across two weeks", () => {
    const trip = occ(allDay("2026-10-14", "2026-10-21", { category: "travel" }));
    // Week of 12–18 Oct: from Wednesday to the week end.
    expect(barLane(weeks[2], [trip])).toEqual({
      occurrence: trip,
      startColumn: 2,
      endColumn: 6,
      startsHere: true,
      endsHere: false,
    });
    // Week of 19–25 Oct: from the week start to Wednesday.
    expect(barLane(weeks[3], [trip])).toMatchObject({
      startColumn: 0,
      endColumn: 2,
      startsHere: false,
      endsHere: true,
    });
    expect(barLane(weeks[0], [trip])).toBeNull();
  });

  it("gives the lane to the earliest, then longest event; single days and timed events never", () => {
    const later = occ(allDay("2026-10-15", "2026-10-25"));
    const earlyShort = occ(allDay("2026-10-13", "2026-10-14"));
    const earlyLong = occ(allDay("2026-10-13", "2026-10-17"));
    const single = occ(allDay("2026-10-12", "2026-10-12"));
    const night = occ(timed("2026-10-12", "22:00", "02:00", {}, "2026-10-13"));
    expect(barLane(weeks[2], [later, earlyShort, single, night, earlyLong])?.occurrence).toBe(
      earlyLong,
    );
  });
});

describe("spanInfo, allDayLength, dayTime (D54, D55)", () => {
  it("«Tag 3 von 8» for all-day events of ≥ 2 days only", () => {
    const trip = occ(allDay("2026-10-14", "2026-10-21"));
    expect(spanInfo(trip, "2026-10-16")).toEqual({ day: 3, of: 8 });
    expect(allDayLength(trip)).toBe(8);
    expect(isMultiDayAllDay(trip)).toBe(true);
    expect(spanInfo(occ(allDay("2026-10-01", "2026-10-01")), "2026-10-01")).toBeNull();
  });

  it("timed events crossing midnight get no span, only day times", () => {
    const night = occ(timed("2026-10-02", "22:00", "01:00", {}, "2026-10-05"));
    expect(spanInfo(night, "2026-10-03")).toBeNull();
    expect(dayTime(night, "2026-10-02", ZURICH)).toEqual({
      kind: "starts",
      start: night.start,
      end: night.end,
    });
    expect(dayTime(night, "2026-10-03", ZURICH)).toEqual({ kind: "through" });
    expect(dayTime(night, "2026-10-05", ZURICH)).toEqual({ kind: "ends", end: night.end });
  });

  it("same-day timed and all-day events", () => {
    const dinner = occ(timed("2026-10-02", "19:30", "22:30"));
    expect(dayTime(dinner, "2026-10-02", ZURICH)).toEqual({
      kind: "timed",
      start: dinner.start,
      end: dinner.end,
    });
    expect(dayTime(occ(allDay("2026-10-01", "2026-10-01")), "2026-10-01", ZURICH)).toEqual({
      kind: "allDay",
    });
  });
});

describe("upcoming (CAL-03, B9)", () => {
  // Mi., 30. Sept. 2026, 14:10 in Zurich.
  const now = new Date("2026-09-30T12:10:00Z");
  const days = (groups: ReturnType<typeof upcoming>) =>
    groups.map((g) => [g.dayKey, g.occurrences.map((o) => o.event.title)]);

  it("lists a one-day all-day event today under today", () => {
    const delivery = occ(allDay("2026-09-30", "2026-09-30", { title: "Möbellieferung" }));
    expect(days(upcoming([delivery], now, ZURICH))).toEqual([["2026-09-30", ["Möbellieferung"]]]);
  });

  it("still lists a multi-day event on its last day, under today", () => {
    const trip = occ(allDay("2026-09-23", "2026-09-30", { title: "Ferien" }));
    expect(days(upcoming([trip], now, ZURICH))).toEqual([["2026-09-30", ["Ferien"]]]);
  });

  it("drops a timed event that ended an hour ago and keeps a running one under today", () => {
    const over = occ(timed("2026-09-30", "12:00", "13:10", { title: "Vorbei" }));
    const running = occ(timed("2026-09-29", "20:00", "18:00", { title: "Läuft" }, "2026-09-30"));
    expect(days(upcoming([over, running], now, ZURICH))).toEqual([["2026-09-30", ["Läuft"]]]);
  });

  it("lists a multi-day event once, on its first day", () => {
    const trip = occ(allDay("2026-10-14", "2026-10-21", { title: "Ferien" }));
    expect(days(upcoming([trip], now, ZURICH))).toEqual([["2026-10-14", ["Ferien"]]]);
  });

  it("looks 60 days ahead (today + 59)", () => {
    const day59 = occ(allDay("2026-11-28", "2026-11-28", { title: "Tag 59" }));
    const day60 = occ(allDay("2026-11-29", "2026-11-29", { title: "Tag 60" }));
    const timed59 = occ(timed("2026-11-28", "23:30", "23:45", { title: "Spät 59" }));
    const timed60 = occ(timed("2026-11-29", "00:00", "01:00", { title: "Früh 60" }));
    expect(days(upcoming([day59, day60, timed59, timed60], now, ZURICH))).toEqual([
      ["2026-11-28", ["Tag 59", "Spät 59"]],
    ]);
  });

  it("groups by day in chronological order", () => {
    const b = occ(timed("2026-10-02", "19:30", "22:30", { title: "Znacht" }));
    const a = occ(timed("2026-10-01", "08:00", "09:00", { title: "Früh" }));
    const c = occ(allDay("2026-10-02", "2026-10-02", { title: "Lieferung" }));
    expect(days(upcoming([b, a, c], now, ZURICH))).toEqual([
      ["2026-10-01", ["Früh"]],
      ["2026-10-02", ["Lieferung", "Znacht"]],
    ]);
  });
});

describe("participants (B5, D58)", () => {
  const members = [member("nevio"), member("anna")];

  it("«Alle» shows every current member", () => {
    expect(visibleParticipants("household", members)).toEqual({ everyone: true, members });
  });

  it("a list shows the current members in it; former members are left out", () => {
    expect(visibleParticipants(["anna", "gone"], members)).toEqual({
      everyone: false,
      members: [members[1]],
    });
  });

  it("normalizes what gets saved", () => {
    expect(normalizeParticipants(["anna"], members)).toEqual(["anna"]);
    expect(normalizeParticipants(["anna", "gone", "anna"], members)).toEqual(["anna"]);
    // Every current member picked, or nobody left → «Alle».
    expect(normalizeParticipants(["nevio", "anna"], members)).toBe("household");
    expect(normalizeParticipants(["gone"], members)).toBe("household");
    expect(normalizeParticipants("household", members)).toBe("household");
  });
});
