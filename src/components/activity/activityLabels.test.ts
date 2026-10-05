import { describe, expect, it } from "vitest";
import { groupPurchases, type ActivityRow } from "../../domain/activity";
import { allDayToStored } from "../../domain/eventTime";
import { defaultMembers, makeEvent, makeItem, makeTask } from "../../tests/householdFakes";
import type { ActivityEntry } from "../../types";
import {
  activityDayHeading,
  activityLine,
  activitySubLine,
  activityTime,
  actorName,
} from "./activityLabels";

const ZURICH = "Europe/Zurich";
const members = defaultMembers();
const ctx = { members, householdName: "Musterstrasse 12" };

let seq = 0;
function single(overrides: Partial<ActivityEntry> = {}): ActivityRow {
  seq += 1;
  const entry: ActivityEntry = {
    id: `a${seq}`,
    actorId: "anna",
    type: "task_completed",
    targetType: "task",
    targetId: `t${seq}`,
    targetTitle: "Bad putzen",
    createdAt: new Date("2026-09-30T16:40:00Z"),
    ...overrides,
  };
  return { kind: "single", key: entry.id, entry };
}

const sentence = (row: ActivityRow) => activityLine(row, ctx).sentence;

describe("activityLine (D77)", () => {
  it("words every type as designed", () => {
    expect(sentence(single())).toBe("Anna hat «Bad putzen» erledigt");
    expect(sentence(single({ type: "task_created", actorId: "nevio" }))).toBe(
      "Nevio hat «Bad putzen» erfasst",
    );
    expect(
      sentence(
        single({ type: "item_added", targetType: "item", targetTitle: "Milch", actorId: "nevio" }),
      ),
    ).toBe("Nevio hat «Milch» zum Einkauf hinzugefügt");
    expect(
      sentence(single({ type: "item_purchased", targetType: "item", targetTitle: "Milch" })),
    ).toBe("Anna hat «Milch» gekauft");
    expect(
      sentence(single({ type: "event_created", targetType: "event", targetTitle: "Ferien" })),
    ).toBe("Anna hat «Ferien» erstellt");
    expect(
      sentence(single({ type: "member_joined", targetType: "member", targetTitle: "Anna" })),
    ).toBe("Anna ist Musterstrasse 12 beigetreten");
  });

  it("splits the sentence into the designed parts, with icon and type label", () => {
    expect(activityLine(single(), ctx)).toMatchObject({
      who: "Anna",
      verb: "hat",
      what: "«Bad putzen»",
      tail: " erledigt",
      icon: "taskDone",
      typeLabel: "Aufgabe",
    });
    expect(activityLine(single({ type: "task_created" }), ctx).icon).toBe("taskCreated");
    expect(
      activityLine(single({ type: "member_joined", targetType: "member" }), ctx),
    ).toMatchObject({ verb: "ist", icon: "member", typeLabel: "Mitglied" });
    expect(activityLine(single({ type: "event_created", targetType: "event" }), ctx)).toMatchObject(
      { icon: "event", typeLabel: "Termin" },
    );
  });

  it("words assignments to someone, to oneself and to nobody", () => {
    const assigned = (toId: string | null, toName: string | null) =>
      single({
        type: "task_assigned",
        actorId: "nevio",
        targetTitle: "Küche putzen",
        details: { fromId: "nevio", fromName: "Nevio", toId, toName },
      });
    expect(sentence(assigned("anna", "Anna"))).toBe("Nevio hat «Küche putzen» Anna zugewiesen");
    expect(sentence(assigned("nevio", "Nevio"))).toBe("Nevio hat «Küche putzen» übernommen");
    expect(sentence(assigned(null, null))).toBe(
      "Nevio hat die Zuweisung von «Küche putzen» entfernt",
    );
    expect(activityLine(assigned("anna", "Anna"), ctx).icon).toBe("assign");
    expect(sentence(assigned("gone", null))).toBe(
      "Nevio hat «Küche putzen» Ehemaliges Mitglied zugewiesen",
    );
  });

  it("groups purchases into «4 Artikel gekauft»", () => {
    const rows = groupPurchases(
      ["Olivenöl", "WC-Papier", "Eier", "Brot"].map((name, i) => ({
        id: `p${i}`,
        actorId: "anna",
        type: "item_purchased" as const,
        targetType: "item" as const,
        targetId: `i${i}`,
        targetTitle: name,
        createdAt: new Date(Date.UTC(2026, 8, 29, 15, 45 - i * 5)),
      })),
      ZURICH,
    );
    expect(activityLine(rows[0], ctx)).toMatchObject({
      sentence: "Anna hat 4 Artikel gekauft",
      what: "4 Artikel",
      typeLabel: "Einkauf",
    });
  });

  it("keeps the snapshot title of a deleted target and names former members (D82)", () => {
    expect(sentence(single({ actorId: "lea", targetTitle: "Gelöscht" }))).toBe(
      "Ehemaliges Mitglied hat «Gelöscht» erledigt",
    );
    expect(actorName("lea", members)).toBe("Ehemaliges Mitglied");
  });
});

describe("activitySubLine (D78, D79)", () => {
  it("names the next occurrence with its assignee, or its date alone", () => {
    const next = makeTask({ dueDate: "2026-10-10", assigneeId: "nevio" });
    expect(activitySubLine({ kind: "nextOccurrence", task: next }, members, ZURICH)).toEqual({
      text: "Nächstes Mal ist Nevio dran · Sa., 10. Okt.",
    });
    const unassigned = { ...next, assigneeId: null };
    expect(activitySubLine({ kind: "nextOccurrence", task: unassigned }, members, ZURICH)).toEqual({
      text: "Nächstes Mal am Sa., 10. Okt.",
    });
    const undated = { ...next, dueDate: null };
    expect(activitySubLine({ kind: "nextOccurrence", task: undated }, members, ZURICH)).toBeNull();
  });

  it("shows an item's quantity and category", () => {
    const milk = makeItem({ quantity: "2 l" });
    expect(activitySubLine({ kind: "item", item: milk }, members, ZURICH)?.text).toBe(
      "2 l · Lebensmittel",
    );
    const tabs = makeItem({ category: "household" });
    expect(activitySubLine({ kind: "item", item: tabs }, members, ZURICH)?.text).toBe("Haushalt");
  });

  it("shows an event's first date, time and participants; a series its rule", () => {
    const party = makeEvent();
    expect(activitySubLine({ kind: "event", event: party }, members, ZURICH)).toEqual({
      text: "Fr., 2. Okt. · 19:30 · Alle",
    });
    const trip = makeEvent({ allDay: true, ...allDayToStored("2026-10-14", "2026-10-21") });
    expect(activitySubLine({ kind: "event", event: trip }, members, ZURICH)?.text).toBe(
      "14.–21. Okt. · Alle",
    );
    const delivery = makeEvent({
      allDay: true,
      participants: ["anna"],
      ...allDayToStored("2026-10-01", "2026-10-01"),
    });
    expect(activitySubLine({ kind: "event", event: delivery }, members, ZURICH)?.text).toBe(
      "Do., 1. Okt. · Ganztägig · Anna",
    );
    const cleaning = makeEvent({
      start: new Date("2026-09-19T08:00:00Z"),
      end: new Date("2026-09-19T10:00:00Z"),
      recurrence: { freq: "weekly", interval: 2, byWeekday: [6] },
    });
    expect(activitySubLine({ kind: "event", event: cleaning }, members, ZURICH)).toEqual({
      text: "Sa., 19. Sept. · 10:00 · Alle",
      repeat: "Alle 2 Wochen",
    });
  });

  it("shows the previous assignee, «niemand» for nobody", () => {
    expect(
      activitySubLine({ kind: "previousAssignee", name: "Nevio" }, members, ZURICH)?.text,
    ).toBe("Vorher: Nevio");
    expect(activitySubLine({ kind: "previousAssignee", name: null }, members, ZURICH)?.text).toBe(
      "Vorher: niemand",
    );
  });

  it("lists up to five purchased names, then «und n weitere»", () => {
    const names = ["Brot", "Eier", "WC-Papier", "Olivenöl"];
    expect(activitySubLine({ kind: "purchases", names }, members, ZURICH)?.text).toBe(
      "Brot, Eier, WC-Papier, Olivenöl",
    );
    const seven = [...names, "Milch", "Käse", "Salz"];
    expect(activitySubLine({ kind: "purchases", names: seven }, members, ZURICH)?.text).toBe(
      "Brot, Eier, WC-Papier, Olivenöl, Milch und 2 weitere",
    );
  });

  it("is null without a subject", () => {
    expect(activitySubLine(null, members, ZURICH)).toBeNull();
  });
});

describe("activityDayHeading (D80)", () => {
  const today = "2026-09-30";

  it("labels today, yesterday and the last week with the date beside", () => {
    expect(activityDayHeading(today, today)).toEqual({ label: "Heute", date: "Mi., 30. Sept." });
    expect(activityDayHeading("2026-09-29", today)).toEqual({
      label: "Gestern",
      date: "Di., 29. Sept.",
    });
    expect(activityDayHeading("2026-09-28", today)).toEqual({
      label: "Montag",
      date: "Mo., 28. Sept.",
    });
    expect(activityDayHeading("2026-09-24", today)).toEqual({
      label: "Donnerstag",
      date: "Do., 24. Sept.",
    });
  });

  it("labels older days with the date alone, with the year if not this year", () => {
    expect(activityDayHeading("2026-09-23", today)).toEqual({ label: "Mi., 23. Sept." });
    expect(activityDayHeading("2025-12-20", "2026-01-02")).toEqual({ label: "Sa., 20. Dez. 2025" });
    // Within the last week the weekday stays, also across the new year.
    expect(activityDayHeading("2025-12-31", "2026-01-02")).toEqual({
      label: "Mittwoch",
      date: "Mi., 31. Dez.",
    });
  });
});

describe("activityTime", () => {
  it("is the local time of the row's newest entry", () => {
    expect(activityTime(single(), ZURICH)).toBe("18:40");
    expect(activityTime(single(), "America/New_York")).toBe("12:40");
  });
});
