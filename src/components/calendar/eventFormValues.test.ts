import { describe, expect, it } from "vitest";
import { allDayToStored, zonedToInstant } from "../../domain/eventTime";
import { eventPickerFromRule, type EventPickerState } from "../../domain/recurrence";
import type { CalendarEvent, Member } from "../../types";
import {
  eventChanges,
  eventInput,
  formRule,
  initialEventFormValues,
  snappedValues,
  toggleParticipant,
  validateEventForm,
  withAllDay,
  withEnd,
  withStart,
  type EventFormValues,
} from "./eventFormValues";

const ZURICH = "Europe/Zurich";
// Mi., 30. Sept. 2026, 14:10 in Zurich.
const NOW = new Date("2026-09-30T12:10:00Z");
const ctx = { now: NOW, timeZone: ZURICH };

const member = (uid: string): Member => ({
  uid,
  displayName: uid,
  initials: uid.slice(0, 2).toUpperCase(),
  avatarColor: 1,
  role: "member",
  joinedAt: new Date("2026-09-01T10:00:00Z"),
});
const members = [member("nevio"), member("anna")];

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "e1",
    title: "Znacht",
    description: "Dessert mitbringen",
    category: "social",
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
}

const values = (overrides: Partial<EventFormValues> = {}): EventFormValues => ({
  title: "Znacht",
  description: "",
  category: "other",
  allDay: false,
  startKey: "2026-10-02",
  startTime: "19:30",
  endKey: "2026-10-02",
  endTime: "22:30",
  participants: "household",
  repeat: eventPickerFromRule(undefined, overrides.startKey ?? "2026-10-02"),
  ...overrides,
});

describe("initial values (B6)", () => {
  it("a new event today starts at the next full hour, for everyone, «Sonstiges»", () => {
    expect(initialEventFormValues(undefined, {}, ctx)).toEqual({
      title: "",
      description: "",
      category: "other",
      allDay: false,
      startKey: "2026-09-30",
      startTime: "15:00",
      endKey: "2026-09-30",
      endTime: "16:00",
      participants: "household",
      repeat: {
        freq: "none",
        n: 2,
        weekdays: [3],
        monthlyMode: "day",
        end: "never",
        until: "2026-12-31",
        count: 10,
      },
    });
  });

  it("a new event on another day starts at 09:00 and keeps a prefilled title", () => {
    expect(
      initialEventFormValues(undefined, { title: "Znacht", dayKey: "2026-10-14" }, ctx),
    ).toMatchObject({
      title: "Znacht",
      startKey: "2026-10-14",
      startTime: "09:00",
      endTime: "10:00",
    });
  });

  it("reads a timed event in the household zone", () => {
    expect(initialEventFormValues(event(), {}, ctx)).toMatchObject({
      title: "Znacht",
      description: "Dessert mitbringen",
      startKey: "2026-10-02",
      startTime: "19:30",
      endKey: "2026-10-02",
      endTime: "22:30",
    });
  });

  it("reads an all-day event by its keys and keeps default times for switching", () => {
    const trip = event({ allDay: true, ...allDayToStored("2026-10-14", "2026-10-21") });
    expect(initialEventFormValues(trip, {}, ctx)).toMatchObject({
      allDay: true,
      startKey: "2026-10-14",
      endKey: "2026-10-21",
      startTime: "09:00",
      endTime: "10:00",
    });
  });
});

describe("editing times (B6, D48)", () => {
  it("keeps the end while it's still on or after the new start", () => {
    // 19:30–22:30: an earlier or later start before the end leaves the end alone.
    expect(withStart(values(), { time: "21:00" }, ZURICH)).toMatchObject({
      startTime: "21:00",
      endKey: "2026-10-02",
      endTime: "22:30",
    });
    expect(withStart(values(), { time: "08:00" }, ZURICH)).toMatchObject({
      startTime: "08:00",
      endTime: "22:30",
    });
    expect(withStart(values(), { key: "2026-09-25" }, ZURICH)).toMatchObject({
      startKey: "2026-09-25",
      endKey: "2026-10-02",
      endTime: "22:30",
    });
    // A start equal to the end is still fine (zero length).
    expect(withStart(values(), { time: "22:30" }, ZURICH)).toMatchObject({ endTime: "22:30" });
  });

  it("takes the end along only when the start moves past it, keeping the duration", () => {
    expect(withStart(values(), { time: "23:00" }, ZURICH)).toMatchObject({
      startTime: "23:00",
      endKey: "2026-10-03",
      endTime: "02:00",
    });
    expect(withStart(values(), { key: "2026-10-09" }, ZURICH)).toMatchObject({
      startKey: "2026-10-09",
      endKey: "2026-10-09",
      endTime: "22:30",
    });
  });

  it("all-day: keeps the last day unless the first day moves past it", () => {
    const trip = values({ allDay: true, startKey: "2026-10-14", endKey: "2026-10-21" });
    expect(withStart(trip, { key: "2026-10-10" }, ZURICH)).toMatchObject({
      startKey: "2026-10-10",
      endKey: "2026-10-21",
    });
    expect(withStart(trip, { key: "2026-10-21" }, ZURICH)).toMatchObject({
      endKey: "2026-10-21",
    });
    expect(withStart(trip, { key: "2026-10-30" }, ZURICH)).toMatchObject({
      startKey: "2026-10-30",
      endKey: "2026-11-06",
    });
  });

  it("changing only the end can make it invalid", () => {
    const early = withEnd(values(), { time: "19:00" });
    expect(validateEventForm(early, ZURICH).times).toBe("endBeforeStart");
  });

  it("«Ganztägig» keeps the days, an end at 00:00 doesn't count, and off restores the times", () => {
    const late = values({ startTime: "22:00", endKey: "2026-10-03", endTime: "00:00" });
    expect(withAllDay(late, true)).toMatchObject({
      allDay: true,
      startKey: "2026-10-02",
      endKey: "2026-10-02",
    });
    const night = values({ startTime: "22:00", endKey: "2026-10-03", endTime: "02:00" });
    expect(withAllDay(night, true).endKey).toBe("2026-10-03");
    expect(withAllDay(withAllDay(values(), true), false)).toMatchObject({
      allDay: false,
      startTime: "19:30",
      endTime: "22:30",
    });
    const same = values();
    expect(withAllDay(same, false)).toBe(same);
  });
});

describe("«Für» chips (D58)", () => {
  it("«Alle» → the picked member only; more add up; all → «Alle»", () => {
    const anna = toggleParticipant("household", "anna", members);
    expect(anna).toEqual(["anna"]);
    expect(toggleParticipant(anna, "nevio", members)).toBe("household");
  });

  it("the last member can't be removed; another one can", () => {
    expect(toggleParticipant(["anna"], "anna", members)).toEqual(["anna"]);
    const three = [...members, member("mia")];
    expect(toggleParticipant(["anna", "mia"], "mia", three)).toEqual(["anna"]);
  });

  it("with one member there is only «Alle»", () => {
    expect(toggleParticipant("household", "nevio", [member("nevio")])).toBe("household");
  });

  it("drops former members while toggling", () => {
    const three = [...members, member("mia")];
    expect(toggleParticipant(["gone", "anna"], "mia", three)).toEqual(["anna", "mia"]);
  });
});

describe("validation (CAL-04, CAL-05, B3)", () => {
  it("needs a title of at most 200 characters", () => {
    expect(validateEventForm(values({ title: "  " }), ZURICH).title).toBe("titleEmpty");
    expect(validateEventForm(values({ title: "x".repeat(201) }), ZURICH).title).toBe(
      "titleTooLong",
    );
    expect(validateEventForm(values(), ZURICH)).toEqual({});
  });

  it("limits the description and the length", () => {
    expect(validateEventForm(values({ description: "x".repeat(2001) }), ZURICH).description).toBe(
      "descriptionTooLong",
    );
    const year = values({ allDay: true, startKey: "2026-01-01", endKey: "2027-01-02" });
    expect(validateEventForm(year, ZURICH).times).toBe("tooLong");
  });
});

describe("what gets saved", () => {
  it("a timed event as instants, trimmed, participants normalised", () => {
    expect(
      eventInput(
        values({ title: " Znacht ", description: "  ", participants: ["anna", "nevio"] }),
        ZURICH,
        members,
      ),
    ).toEqual({
      title: "Znacht",
      category: "other",
      allDay: false,
      start: new Date("2026-10-02T17:30:00Z"),
      end: new Date("2026-10-02T20:30:00Z"),
      participants: "household",
    });
  });

  it("an all-day event as 00:00 UTC dates (B2)", () => {
    const trip = values({ allDay: true, startKey: "2026-10-14", endKey: "2026-10-21" });
    expect(eventInput(trip, ZURICH, members)).toMatchObject({
      allDay: true,
      start: new Date("2026-10-14T00:00:00Z"),
      end: new Date("2026-10-21T00:00:00Z"),
    });
  });

  it("only the changed fields; a cleared description is null", () => {
    const original = event();
    const edited = { ...initialEventFormValues(original, {}, ctx), category: "home" as const };
    expect(eventChanges(original, edited, ZURICH, members)).toEqual({ category: "home" });
    expect(eventChanges(original, { ...edited, description: "" }, ZURICH, members)).toMatchObject({
      description: null,
    });
    expect(
      eventChanges(original, initialEventFormValues(original, {}, ctx), ZURICH, members),
    ).toEqual({});
  });

  it("writes participants when a former member has to be dropped (B5)", () => {
    const original = event({ participants: ["anna", "gone"] });
    const edited = { ...initialEventFormValues(original, {}, ctx), title: "Arzt" };
    expect(eventChanges(original, edited, ZURICH, members)).toEqual({
      title: "Arzt",
      participants: ["anna"],
    });
  });

  it("switching to all-day changes allDay, start and end", () => {
    const original = event();
    const edited = withAllDay(initialEventFormValues(original, {}, ctx), true);
    expect(eventChanges(original, edited, ZURICH, members)).toEqual({
      allDay: true,
      start: new Date("2026-10-02T00:00:00Z"),
      end: new Date("2026-10-02T00:00:00Z"),
    });
  });
});

describe("«Wiederholen» (Phase 7 B3, B10, D66)", () => {
  const everyOtherSat = { freq: "weekly" as const, interval: 2, byWeekday: [6] };
  const repeat = (patch: Partial<EventPickerState>, startKey = "2026-10-03") => ({
    ...eventPickerFromRule(undefined, startKey),
    ...patch,
  });
  const cleaning = (overrides: Partial<EventFormValues> = {}) =>
    values({
      title: "Grossputz",
      startKey: "2026-10-03",
      endKey: "2026-10-03",
      startTime: "10:00",
      endTime: "12:00",
      repeat: repeat({ freq: "nweeks", n: 2, weekdays: [6] }),
      ...overrides,
    });

  it("reads a stored rule into the picker", () => {
    const series = event({
      start: zonedToInstant("2026-09-19", "10:00", ZURICH),
      end: zonedToInstant("2026-09-19", "12:00", ZURICH),
      recurrence: { ...everyOtherSat, count: 4 },
    });
    expect(initialEventFormValues(series, {}, ctx).repeat).toMatchObject({
      freq: "nweeks",
      n: 2,
      weekdays: [6],
      end: "after",
      count: 4,
    });
  });

  it("builds the rule from the start day; monthly and yearly follow it", () => {
    expect(formRule(cleaning())).toEqual(everyOtherSat);
    expect(formRule(values())).toBeNull();
    const monthly = cleaning({ repeat: repeat({ freq: "monthly", monthlyMode: "weekday" }) });
    expect(formRule(monthly)).toEqual({
      freq: "monthly",
      interval: 1,
      byWeekday: [6],
      bySetPos: 1,
    });
    // B10: a new start re-derives weekday and position (31 Oct = the last Saturday).
    const moved = withStart(monthly, { key: "2026-10-31" }, ZURICH);
    expect(formRule(moved)).toMatchObject({ byWeekday: [6], bySetPos: -1 });
    const yearly = withStart(
      cleaning({ repeat: repeat({ freq: "yearly" }) }),
      { key: "2027-02-28" },
      ZURICH,
    );
    expect(formRule(yearly)).toEqual({ freq: "yearly", interval: 1, byMonth: 2, byMonthDay: 28 });
  });

  it("moves an off-schedule start to the first occurrence on save (B3)", () => {
    // Thu 1 Oct with «Jeden Samstag» → Sat 3 Oct, same times; a two-day event keeps its length.
    const thursday = cleaning({
      startKey: "2026-10-01",
      endKey: "2026-10-02",
      repeat: repeat({ freq: "weekly", weekdays: [6] }, "2026-10-01"),
    });
    expect(snappedValues(thursday, 1)).toMatchObject({
      startKey: "2026-10-03",
      endKey: "2026-10-04",
      startTime: "10:00",
      endTime: "12:00",
    });
    const input = eventInput(thursday, ZURICH, members, 1);
    expect(input.start).toEqual(zonedToInstant("2026-10-03", "10:00", ZURICH));
    expect(input.end).toEqual(zonedToInstant("2026-10-04", "12:00", ZURICH));
    expect(input.recurrence).toEqual({ freq: "weekly", interval: 1, byWeekday: [6] });
    // On schedule (or no rule): unchanged.
    expect(snappedValues(cleaning(), 1)).toEqual(cleaning());
    expect(snappedValues(values(), 1)).toEqual(values());
    expect(eventInput(values(), ZURICH, members)).not.toHaveProperty("recurrence");
  });

  it("rejects «Endet am» before the first occurrence (D66)", () => {
    const until = (key: string, startKey = "2026-10-03") =>
      validateEventForm(
        cleaning({
          startKey,
          endKey: startKey,
          repeat: repeat({ freq: "weekly", weekdays: [6], end: "date", until: key }, startKey),
        }),
        ZURICH,
        1,
      ).until;
    expect(until("2026-10-03")).toBeUndefined();
    expect(until("2026-10-02")).toBe("untilBeforeStart");
    // Thu start, Sat rule: until Friday is after the start but before the first occurrence.
    expect(until("2026-10-02", "2026-10-01")).toBe("untilBeforeStart");
    expect(until("2026-10-03", "2026-10-01")).toBeUndefined();
    // «Nie» and «Nach N Mal» ignore the kept date.
    expect(
      validateEventForm(
        cleaning({ repeat: repeat({ freq: "daily", until: "2020-01-01" }) }),
        ZURICH,
      ).until,
    ).toBeUndefined();
  });

  it("sends a changed rule, an end-only change, or «Nie» as null (B10)", () => {
    const original = event({
      start: zonedToInstant("2026-10-03", "10:00", ZURICH),
      end: zonedToInstant("2026-10-03", "12:00", ZURICH),
      recurrence: everyOtherSat,
    });
    const loaded = initialEventFormValues(original, {}, ctx);
    expect(eventChanges(original, loaded, ZURICH, members, 1)).toEqual({});
    expect(
      eventChanges(
        original,
        { ...loaded, repeat: { ...loaded.repeat, end: "after", count: 5 } },
        ZURICH,
        members,
        1,
      ),
    ).toEqual({ recurrence: { ...everyOtherSat, count: 5 } });
    expect(
      eventChanges(
        original,
        { ...loaded, repeat: { ...loaded.repeat, freq: "none" } },
        ZURICH,
        members,
        1,
      ),
    ).toEqual({ recurrence: null });
    const oneOff = event();
    expect(
      eventChanges(
        oneOff,
        {
          ...initialEventFormValues(oneOff, {}, ctx),
          repeat: repeat({ freq: "daily" }, "2026-10-02"),
        },
        ZURICH,
        members,
        1,
      ),
    ).toEqual({ recurrence: { freq: "daily", interval: 1 } });
  });
});
