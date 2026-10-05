import { describe, expect, it } from "vitest";
import { singleOccurrence } from "../../domain/calendar";
import { allDayToStored, zonedToInstant } from "../../domain/eventTime";
import type { CalendarEvent, EventOccurrence, Member } from "../../types";
import {
  dateLine,
  dayCellLabel,
  participantNames,
  repeatLabel,
  ruleLine,
  seriesDetail,
  selectedDayTitle,
  spanLabel,
  timeColumn,
  timeLine,
  upcomingHeader,
  upcomingSpan,
} from "./calendarLabels";

const ZURICH = "Europe/Zurich";
const NEW_YORK = "America/New_York";

function occ(overrides: Partial<CalendarEvent>): EventOccurrence {
  const event: CalendarEvent = {
    id: "e1",
    title: "Termin",
    category: "other",
    allDay: false,
    start: zonedToInstant("2026-10-02", "19:30", ZURICH),
    end: zonedToInstant("2026-10-02", "22:30", ZURICH),
    participants: "household",
    createdBy: "nevio",
    createdAt: new Date("2026-09-01T10:00:00Z"),
    updatedAt: new Date("2026-09-01T10:00:00Z"),
    hasPendingWrites: false,
    ...overrides,
  };
  return singleOccurrence(event, "Europe/Zurich");
}

const member = (uid: string, displayName: string): Member => ({
  uid,
  displayName,
  initials: displayName.slice(0, 2).toUpperCase(),
  avatarColor: 1,
  role: "member",
  joinedAt: new Date("2026-09-01T10:00:00Z"),
});
const members = [member("nevio", "Nevio Apicella"), member("anna", "Anna")];

const dinner = occ({});
const trip = occ({ allDay: true, ...allDayToStored("2026-10-14", "2026-10-21") });
const delivery = occ({ allDay: true, ...allDayToStored("2026-10-01", "2026-10-01") });
const night = occ({
  start: zonedToInstant("2026-10-02", "22:00", ZURICH),
  end: zonedToInstant("2026-10-04", "02:00", ZURICH),
});

describe("time column and line (D55)", () => {
  it("shows start over end for a same-day event", () => {
    expect(timeColumn(dinner, "2026-10-02", ZURICH)).toEqual({
      primary: "19:30",
      secondary: "22:30",
    });
    expect(timeLine(dinner, "2026-10-02", ZURICH)).toBe("19:30–22:30");
  });

  it("shows «Ganztägig» for all-day events", () => {
    expect(timeColumn(trip, "2026-10-16", ZURICH)).toEqual({ primary: "Ganztägig" });
    expect(timeLine(trip, "2026-10-16", ZURICH)).toBe("Ganztägig");
  });

  it("labels each day of a timed event crossing midnight", () => {
    expect(timeColumn(night, "2026-10-02", ZURICH)).toEqual({
      primary: "22:00",
      secondary: "bis So.",
    });
    expect(timeLine(night, "2026-10-02", ZURICH)).toBe("22:00 · bis So.");
    expect(timeColumn(night, "2026-10-03", ZURICH)).toEqual({ primary: "Ganztägig" });
    expect(timeColumn(night, "2026-10-04", ZURICH)).toEqual({ primary: "bis 02:00" });
  });
});

describe("spans (D54, B9)", () => {
  it("«Tag 3 von 8» and «14.–21. Okt. · 8 Tage» for all-day trips only", () => {
    expect(spanLabel(trip, "2026-10-16")).toBe("Tag 3 von 8");
    expect(upcomingSpan(trip)).toBe("14.–21. Okt. · 8 Tage");
    expect(spanLabel(delivery, "2026-10-01")).toBeUndefined();
    expect(upcomingSpan(night)).toBeUndefined();
  });
});

describe("date and rule lines", () => {
  it("dates the Termin-Detail", () => {
    expect(dateLine(dinner, ZURICH)).toBe("Fr., 2. Okt. · 19:30–22:30");
    expect(dateLine(delivery, ZURICH)).toBe("Do., 1. Okt. · Ganztägig");
    expect(dateLine(trip, ZURICH)).toBe("Mi., 14. – Mi., 21. Okt. · 8 Tage");
    expect(dateLine(night, ZURICH)).toBe("Fr., 2. Okt., 22:00 – So., 4. Okt., 02:00");
  });

  it("shows all-day dates by their keys, also in New York (B2)", () => {
    expect(dateLine(delivery, NEW_YORK)).toBe("Do., 1. Okt. · Ganztägig");
    expect(dateLine(trip, NEW_YORK)).toBe("Mi., 14. – Mi., 21. Okt. · 8 Tage");
  });

  it("writes the expanded card's rule line", () => {
    expect(ruleLine(dinner, ZURICH, members)).toBe("Wiederholt sich nicht · 19:30–22:30");
    expect(ruleLine(delivery, ZURICH, members)).toBe("Wiederholt sich nicht · Ganztägig");
    expect(ruleLine(trip, ZURICH, members)).toBe("Mi., 14. – Mi., 21. Okt. · 8 Tage · Alle");
    expect(ruleLine(night, ZURICH, members)).toBe("Fr., 2. Okt., 22:00 – So., 4. Okt., 02:00");
  });
});

describe("participants (B5)", () => {
  it("«Alle» or first names of current members", () => {
    expect(participantNames("household", members)).toBe("Alle");
    expect(participantNames(["anna"], members)).toBe("Anna");
    expect(participantNames(["nevio", "anna", "gone"], members)).toBe("Nevio und Anna");
  });
});

describe("day headers", () => {
  it("names today, tomorrow and yesterday", () => {
    expect(selectedDayTitle("2026-09-30", "2026-09-30")).toBe("Heute · Mi., 30. Sept.");
    expect(selectedDayTitle("2026-10-01", "2026-09-30")).toBe("Morgen · Do., 1. Okt.");
    expect(selectedDayTitle("2026-09-29", "2026-09-30")).toBe("Gestern · Di., 29. Sept.");
    expect(selectedDayTitle("2026-10-14", "2026-09-30")).toBe("Mi., 14. Okt.");
  });

  it("labels cells and «Demnächst» groups", () => {
    expect(dayCellLabel("2026-09-30", "2026-09-30", 2)).toBe("Mi., 30. Sept., heute, 2 Termine");
    expect(upcomingHeader("2026-09-30", "2026-09-30")).toEqual({
      relative: "Heute",
      date: "30. Sept.",
      isToday: true,
    });
    expect(upcomingHeader("2026-10-01", "2026-09-30").relative).toBe("Morgen");
    expect(upcomingHeader("2026-10-03", "2026-09-30").relative).toBe("Sa.");
    expect(upcomingHeader("2026-10-14", "2026-09-30")).toMatchObject({
      relative: "Mi.",
      date: "14. Okt.",
    });
  });
});

describe("series labels (Phase 7 B8, D63–D65)", () => {
  const everyOtherSat = { freq: "weekly" as const, interval: 2, byWeekday: [6] };
  const cleaning = occ({
    start: zonedToInstant("2026-09-19", "10:00", ZURICH),
    end: zonedToInstant("2026-09-19", "12:00", ZURICH),
    recurrence: everyOtherSat,
  });
  const weekend = occ({
    allDay: true,
    ...allDayToStored("2026-10-02", "2026-10-04"),
    participants: ["anna"],
    recurrence: { freq: "weekly", interval: 1, byWeekday: [5], count: 3 },
  });

  it("labels cards with the short rule", () => {
    expect(repeatLabel(cleaning)).toBe("Alle 2 Wochen");
    expect(repeatLabel(weekend)).toBe("Wöchentlich");
    expect(repeatLabel(dinner)).toBeUndefined();
  });

  it("writes the rule line with time, «Ganztägig» or the length, and participants", () => {
    expect(ruleLine(cleaning, ZURICH, members)).toBe(
      "Alle 2 Wochen · Samstag · 10:00–12:00 · Alle",
    );
    expect(ruleLine(weekend, ZURICH, members)).toBe("Jeden Freitag · 3 Tage · Anna");
    const rent = occ({
      allDay: true,
      ...allDayToStored("2026-10-01", "2026-10-01"),
      recurrence: { freq: "monthly", interval: 1, byMonthDay: 1 },
    });
    expect(ruleLine(rent, ZURICH, members)).toBe("Monatlich am 1. · Ganztägig · Alle");
    const twoDays = occ({ recurrence: { freq: "weekly", interval: 1, byWeekday: [0, 1] } });
    expect(ruleLine(twoDays, ZURICH, members, 0)).toBe(
      "Wöchentlich am Sonntag, Montag · 19:30–22:30 · Alle",
    );
    expect(ruleLine(twoDays, ZURICH, members, 1)).toBe(
      "Wöchentlich am Montag, Sonntag · 19:30–22:30 · Alle",
    );
  });

  it("builds the detail's rule block and next dates", () => {
    const trip = occ({
      id: "trip",
      category: "travel",
      allDay: true,
      ...allDayToStored("2026-10-14", "2026-10-21"),
    }).event;
    expect(
      seriesDetail(cleaning, [cleaning.event, trip], ZURICH, 1, "2026-09-30", members),
    ).toEqual({
      rule: "Alle 2 Wochen · Samstag · 10:00–12:00 · Alle",
      since: "Seit Sa., 19. Sept. · endet nie",
      next: [
        { key: "e1@2026-10-03", date: "Sa., 3. Okt.", time: "10:00–12:00", duringTrip: false },
        { key: "e1@2026-10-17", date: "Sa., 17. Okt.", time: "10:00–12:00", duringTrip: true },
        { key: "e1@2026-10-31", date: "Sa., 31. Okt.", time: "10:00–12:00", duringTrip: false },
      ],
    });
    expect(seriesDetail(weekend, [weekend.event], ZURICH, 1, "2026-09-30", members)).toEqual({
      rule: "Jeden Freitag · 3 Tage · Anna",
      since: "Seit Fr., 2. Okt. · endet nach 3 Terminen",
      next: [
        { key: "e1@2026-10-09", date: "Fr., 9. Okt.", time: "3 Tage", duringTrip: false },
        { key: "e1@2026-10-16", date: "Fr., 16. Okt.", time: "3 Tage", duringTrip: false },
      ],
    });
    expect(seriesDetail(dinner, [dinner.event], ZURICH, 1, "2026-09-30", members)).toBeNull();
  });
});
