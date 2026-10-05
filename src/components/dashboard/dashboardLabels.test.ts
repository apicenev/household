import { describe, expect, it } from "vitest";
import { upcomingWeek } from "../../domain/dashboard";
import { allDayToStored } from "../../domain/eventTime";
import { makeEvent } from "../../tests/householdFakes";
import { allDoneText, dashboardSummary, upcomingDateColumn, upcomingWhen } from "./dashboardLabels";

const ZURICH = "Europe/Zurich";
const NOW = new Date("2026-09-30T06:12:00Z");
const TODAY = "2026-09-30";

describe("dashboardSummary (D69)", () => {
  it("joins the three counts as designed", () => {
    expect(dashboardSummary({ tasks: 3, items: 6, events: 5 })).toBe(
      "3 Aufgaben heute · 6 Artikel offen · 5 Termine diese Woche",
    );
  });

  it("uses singular and zero forms", () => {
    expect(dashboardSummary({ tasks: 1, items: 1, events: 1 })).toBe(
      "1 Aufgabe heute · 1 Artikel offen · 1 Termin diese Woche",
    );
    expect(dashboardSummary({ tasks: 0, items: 0, events: 0 })).toBe(
      "Heute nichts mehr zu tun · nichts auf der Einkaufsliste · keine Termine diese Woche",
    );
  });

  it("leaves out a list that is loading or failed", () => {
    expect(dashboardSummary({ tasks: 2, items: null, events: 4 })).toBe(
      "2 Aufgaben heute · 4 Termine diese Woche",
    );
    expect(dashboardSummary({ tasks: null, items: null, events: null })).toBe("");
  });
});

describe("allDoneText (D68)", () => {
  const next = { title: "Bad putzen", dueDate: "2026-10-03" };

  it("praises by member count on phones, names the next task on both", () => {
    expect(allDoneText(2, next, TODAY)).toEqual({
      mobile: "Gut gemacht, ihr zwei. Als Nächstes: «Bad putzen» am Samstag.",
      desktop: "Als Nächstes: «Bad putzen» am Samstag.",
    });
    expect(allDoneText(1, next, TODAY).mobile).toMatch(/^Gut gemacht\. /);
    expect(allDoneText(3, next, TODAY).mobile).toMatch(/^Gut gemacht, ihr alle\. /);
  });

  it("says «morgen» for tomorrow and the date beyond a week", () => {
    expect(allDoneText(2, { ...next, dueDate: "2026-10-01" }, TODAY).desktop).toBe(
      "Als Nächstes: «Bad putzen» morgen.",
    );
    expect(allDoneText(2, { ...next, dueDate: "2026-10-10" }, TODAY).desktop).toBe(
      "Als Nächstes: «Bad putzen» am Sa., 10. Okt.",
    );
  });

  it("drops the second sentence without a next task", () => {
    expect(allDoneText(2, null, TODAY)).toEqual({ mobile: "Gut gemacht, ihr zwei.", desktop: "" });
  });
});

describe("«Demnächst» rows (D71)", () => {
  it("shows weekday and day in the date column", () => {
    expect(upcomingDateColumn("2026-10-01")).toEqual({ weekday: "Do", day: "1" });
    expect(upcomingDateColumn("2026-10-04")).toEqual({ weekday: "So", day: "4" });
  });

  it("prefixes today and tomorrow, and labels times, all-day and multi-day events", () => {
    const delivery = makeEvent({
      title: "Möbellieferung",
      allDay: true,
      ...allDayToStored("2026-10-01", "2026-10-01"),
    });
    const party = makeEvent({ title: "Znacht" });
    const trip = makeEvent({
      title: "Ferien",
      allDay: true,
      ...allDayToStored("2026-09-28", "2026-10-02"),
    });
    const weekend = makeEvent({
      title: "Tessin",
      allDay: true,
      ...allDayToStored("2026-10-03", "2026-10-04"),
    });
    const lunch = makeEvent({
      title: "Mittagessen",
      start: new Date("2026-09-30T10:00:00Z"),
      end: new Date("2026-09-30T11:00:00Z"),
    });
    const rows = upcomingWeek([delivery, party, trip, weekend, lunch], NOW, ZURICH, 1);
    const when = Object.fromEntries(
      rows.map((row) => [row.occurrence.event.title, upcomingWhen(row, TODAY, ZURICH)]),
    );
    expect(when).toEqual({
      Ferien: "Heute · Tag 3 von 5",
      Mittagessen: "Heute · 12:00–13:00",
      Möbellieferung: "Morgen · Ganztägig",
      Znacht: "19:30–22:30",
      Tessin: "3.–4. Okt. · 2 Tage",
    });
  });
});
