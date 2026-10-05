import { describe, expect, it } from "vitest";
import { defaultMembers, makeEvent, makeItem, makeTask } from "../tests/householdFakes";
import type { ActivityEntry } from "../types";
import {
  actorOf,
  activityFilterToParams,
  activitySubject,
  compareEntries,
  filterTargetType,
  groupByDay,
  groupPurchases,
  mergeFeed,
  parseActivityFilter,
  rowEntry,
  type ActivityRow,
  type LiveData,
} from "./activity";

const ZURICH = "Europe/Zurich";

let seq = 0;
function entry(overrides: Partial<ActivityEntry> & { at: string }): ActivityEntry {
  seq += 1;
  const { at, ...rest } = overrides;
  return {
    id: `a${String(seq).padStart(3, "0")}`,
    actorId: "anna",
    type: "task_completed",
    targetType: "task",
    targetId: `t${seq}`,
    targetTitle: `Titel ${seq}`,
    createdAt: new Date(at),
    ...rest,
  };
}

const purchase = (at: string, name: string, actorId = "anna") =>
  entry({ at, actorId, type: "item_purchased", targetType: "item", targetTitle: name });

const noLive: LiveData = { tasks: [], items: [], events: [] };

describe("filter (ACT-08, B3)", () => {
  it("maps each chip to its target type, «Alle» to none", () => {
    expect(filterTargetType("all")).toBeUndefined();
    expect(filterTargetType("item")).toBe("item");
  });

  it("reads ?filter=, unknown values are «Alle»", () => {
    expect(parseActivityFilter(new URLSearchParams("filter=event"))).toBe("event");
    expect(parseActivityFilter(new URLSearchParams("filter=all"))).toBe("all");
    expect(parseActivityFilter(new URLSearchParams("filter=reactions"))).toBe("all");
    expect(parseActivityFilter(new URLSearchParams())).toBe("all");
  });

  it("writes ?filter=, keeps other parameters and drops it for «Alle»", () => {
    const base = new URLSearchParams("filter=task&x=1");
    expect(activityFilterToParams("member", base).toString()).toBe("x=1&filter=member");
    expect(activityFilterToParams("all", base).toString()).toBe("x=1");
    expect(activityFilterToParams("task").toString()).toBe("filter=task");
  });
});

describe("mergeFeed (B2)", () => {
  it("keeps entries pushed off the live page, one per id, newest first", () => {
    const a = entry({ at: "2026-09-30T10:00:00Z" });
    const b = entry({ at: "2026-09-30T09:00:00Z" });
    const c = entry({ at: "2026-09-30T08:00:00Z" });
    const newer = entry({ at: "2026-09-30T11:00:00Z" });
    const wrap = (e: ActivityEntry, source: string) => ({ entry: e, source });
    const kept = [wrap(a, "old"), wrap(b, "old"), wrap(c, "old")];
    const live = [wrap(newer, "live"), wrap(a, "live"), wrap(b, "live")];
    const merged = mergeFeed(live, kept);
    expect(merged.map((item) => item.entry.id)).toEqual([newer.id, a.id, b.id, c.id]);
    // The live version wins (e.g. a corrected server time).
    expect(merged[1].source).toBe("live");
    expect(merged[3].source).toBe("old");
  });

  it("orders entries with the same time by id", () => {
    const x = entry({ id: "x", at: "2026-09-30T10:00:00Z" });
    const y = entry({ id: "y", at: "2026-09-30T10:00:00Z" });
    expect([x, y].sort(compareEntries).map((e) => e.id)).toEqual(["y", "x"]);
  });
});

describe("groupPurchases (D79)", () => {
  it("groups consecutive purchases by one person within 30 minutes; key = oldest entry", () => {
    const olive = purchase("2026-09-29T15:45:00Z", "Olivenöl");
    const paper = purchase("2026-09-29T15:40:00Z", "WC-Papier");
    const eggs = purchase("2026-09-29T15:20:00Z", "Eier");
    const bread = purchase("2026-09-29T14:50:00Z", "Brot");
    const rows = groupPurchases([olive, paper, eggs, bread], ZURICH);
    expect(rows).toEqual([
      { kind: "purchases", key: bread.id, entries: [olive, paper, eggs, bread] },
    ]);
    expect(rowEntry(rows[0])).toBe(olive);
  });

  it("keeps the group's key when a newer purchase joins", () => {
    const first = purchase("2026-09-29T15:00:00Z", "Brot");
    const second = purchase("2026-09-29T15:10:00Z", "Eier");
    const before = groupPurchases([second, first], ZURICH);
    const third = purchase("2026-09-29T15:20:00Z", "Milch");
    const after = groupPurchases([third, second, first], ZURICH);
    expect(before[0].key).toBe(first.id);
    expect(after[0].key).toBe(first.id);
  });

  it("splits on a gap over 30 minutes, another actor, another entry or a new day", () => {
    const late = purchase("2026-09-29T16:31:00Z", "Käse");
    const gap = purchase("2026-09-29T16:00:00Z", "Brot"); // 31 min before
    const nevio = purchase("2026-09-29T15:55:00Z", "Milch", "nevio");
    const added = entry({ at: "2026-09-29T15:54:00Z", type: "item_added", targetType: "item" });
    const lone = purchase("2026-09-29T15:50:00Z", "Eier");
    // 00:10 and 23:55 local are 15 minutes apart but on two days.
    const afterMidnight = purchase("2026-09-28T22:10:00Z", "Butter");
    const beforeMidnight = purchase("2026-09-28T21:55:00Z", "Salz");
    const rows = groupPurchases(
      [late, gap, nevio, added, lone, afterMidnight, beforeMidnight],
      ZURICH,
    );
    expect(rows.map((row) => row.kind)).toEqual([
      "single",
      "single",
      "single",
      "single",
      "single",
      "single",
      "single",
    ]);
  });

  it("leaves other entries as single rows keyed by their id", () => {
    const done = entry({ at: "2026-09-30T10:00:00Z" });
    expect(groupPurchases([done], ZURICH)).toEqual([{ kind: "single", key: done.id, entry: done }]);
  });
});

describe("groupByDay (ACT-03, D80)", () => {
  it("groups rows by the local day of their newest entry, newest day first", () => {
    const today = entry({ at: "2026-09-30T06:00:00Z" });
    const lateYesterday = entry({ at: "2026-09-29T21:30:00Z" }); // 23:30 local
    const earlyYesterday = entry({ at: "2026-09-28T22:30:00Z" }); // 00:30 local on 29 Sept
    const monday = entry({ at: "2026-09-28T18:00:00Z" });
    const rows = groupPurchases([today, lateYesterday, earlyYesterday, monday], ZURICH);
    const days = groupByDay(rows, ZURICH);
    expect(days.map((day) => [day.dayKey, day.rows.length])).toEqual([
      ["2026-09-30", 1],
      ["2026-09-29", 2],
      ["2026-09-28", 1],
    ]);
  });

  it("uses the household zone", () => {
    const rows: ActivityRow[] = groupPurchases([entry({ at: "2026-09-30T02:00:00Z" })], ZURICH);
    expect(groupByDay(rows, "America/New_York")[0].dayKey).toBe("2026-09-29");
    expect(groupByDay(rows, ZURICH)[0].dayKey).toBe("2026-09-30");
  });
});

describe("actorOf (D82)", () => {
  it("finds the member, null for someone who left", () => {
    expect(actorOf("anna", defaultMembers())?.displayName).toBe("Anna");
    expect(actorOf("lea", defaultMembers())).toBeNull();
  });
});

describe("activitySubject (D78)", () => {
  const single = (e: ActivityEntry): ActivityRow => ({ kind: "single", key: e.id, entry: e });

  it("a completed series occurrence → its next occurrence while that is open", () => {
    const done = makeTask({ id: "s1-1", seriesId: "s1", seriesIndex: 1, status: "done" });
    const next = makeTask({ id: "s1-2", seriesId: "s1", seriesIndex: 2, dueDate: "2026-10-10" });
    const row = single(entry({ at: "2026-09-30T10:00:00Z", targetId: "s1-1" }));
    expect(activitySubject(row, { ...noLive, tasks: [done, next] })).toEqual({
      kind: "nextOccurrence",
      task: next,
    });
    const nextDone = { ...next, status: "done" as const };
    expect(activitySubject(row, { ...noLive, tasks: [done, nextDone] })).toBeNull();
    // Undone (next occurrence removed), deleted, or a one-off task: none.
    expect(activitySubject(row, { ...noLive, tasks: [done] })).toBeNull();
    expect(activitySubject(row, noLive)).toBeNull();
    const oneOff = makeTask({ id: "o1", status: "done" });
    const oneOffRow = single(entry({ at: "2026-09-30T10:00:00Z", targetId: "o1" }));
    expect(activitySubject(oneOffRow, { ...noLive, tasks: [oneOff] })).toBeNull();
  });

  it("an assignment → the stored previous assignee, null for nobody", () => {
    const assigned = (fromName: string | null) =>
      single(
        entry({
          at: "2026-09-29T19:10:00Z",
          type: "task_assigned",
          details: { fromId: fromName ? "nevio" : null, fromName, toId: "anna", toName: "Anna" },
        }),
      );
    expect(activitySubject(assigned("Nevio"), noLive)).toEqual({
      kind: "previousAssignee",
      name: "Nevio",
    });
    expect(activitySubject(assigned(null), noLive)).toEqual({
      kind: "previousAssignee",
      name: null,
    });
  });

  it("an added item and a created event → the live target, none once deleted", () => {
    const milk = makeItem({ id: "milk", name: "Milch", quantity: "2 l" });
    const added = single(
      entry({
        at: "2026-09-30T15:12:00Z",
        type: "item_added",
        targetType: "item",
        targetId: "milk",
      }),
    );
    expect(activitySubject(added, { ...noLive, items: [milk] })).toEqual({
      kind: "item",
      item: milk,
    });
    expect(activitySubject(added, noLive)).toBeNull();

    const party = makeEvent({ id: "party" });
    const created = single(
      entry({
        at: "2026-09-30T10:05:00Z",
        type: "event_created",
        targetType: "event",
        targetId: "party",
      }),
    );
    expect(activitySubject(created, { ...noLive, events: [party] })).toEqual({
      kind: "event",
      event: party,
    });
    expect(activitySubject(created, noLive)).toBeNull();
  });

  it("a purchase group → the names, oldest first; created tasks, single purchases and joins → none", () => {
    const rows = groupPurchases(
      [purchase("2026-09-29T15:20:00Z", "Eier"), purchase("2026-09-29T15:00:00Z", "Brot")],
      ZURICH,
    );
    expect(activitySubject(rows[0], noLive)).toEqual({
      kind: "purchases",
      names: ["Brot", "Eier"],
    });
    for (const type of ["task_created", "item_purchased", "member_joined"] as const) {
      expect(
        activitySubject(single(entry({ at: "2026-09-30T10:00:00Z", type })), noLive),
      ).toBeNull();
    }
  });
});
