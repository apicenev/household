import { describe, expect, it } from "vitest";
import { makeHousehold, makeTask } from "../tests/householdFakes";
import {
  avatarColorFor,
  canLeave,
  initialsFor,
  memberCleanup,
  rotationOrderWithout,
} from "./member";

describe("initialsFor", () => {
  it("uses the first letters of the first and last word", () => {
    expect(initialsFor("Nevio Apicella")).toBe("NA");
    expect(initialsFor("Anna Maria Muster")).toBe("AM");
  });

  it("uses the first two letters of a single word", () => {
    expect(initialsFor("Anna")).toBe("AN");
    expect(initialsFor("nevio")).toBe("NE");
  });

  it("handles extra whitespace, umlauts and one-letter names", () => {
    expect(initialsFor("  Jürg   Öhler ")).toBe("JÖ");
    expect(initialsFor("X")).toBe("X");
    expect(initialsFor("   ")).toBe("?");
  });
});

describe("avatarColorFor", () => {
  it("is stable per uid and always between 1 and 8", () => {
    const uids = ["rOIoJ3NhRdksfrue74Oqq6cxzMbT", "az46amLxdf1ddNm0tzPGAO0nsX6z", "a", ""];
    for (const uid of uids) {
      const color = avatarColorFor(uid);
      expect(color).toBe(avatarColorFor(uid));
      expect(color).toBeGreaterThanOrEqual(1);
      expect(color).toBeLessThanOrEqual(8);
      expect(Number.isInteger(color)).toBe(true);
    }
  });

  it("spreads uids over the palette", () => {
    const colors = new Set(Array.from({ length: 64 }, (_, i) => avatarColorFor(`user-${i}`)));
    expect(colors.size).toBeGreaterThanOrEqual(6);
  });
});

describe("canLeave (Phase 9 B1, D84, D96)", () => {
  it("lets members leave, not the owner of a shared household", () => {
    const household = makeHousehold({ memberIds: ["nevio", "anna"] });
    expect(canLeave(household, "anna")).toBe("ok");
    expect(canLeave(household, "nevio")).toBe("owner");
  });

  it("doesn't let a sole member leave", () => {
    expect(canLeave(makeHousehold({ memberIds: ["nevio"] }), "nevio")).toBe("alone");
  });

  it("blocks everyone in the demo household", () => {
    const household = makeHousehold({ memberIds: ["nevio", "anna"], demo: true });
    expect(canLeave(household, "anna")).toBe("demo");
    expect(canLeave(household, "nevio")).toBe("demo");
  });
});

describe("memberCleanup (Phase 9 B3)", () => {
  const weekly = { freq: "weekly" as const, interval: 1, byWeekday: [6] };
  const rotating = (memberIds: string[], index: number, id = "t") =>
    makeTask({
      id,
      assigneeId: memberIds[index],
      dueDate: "2026-10-03",
      recurrence: weekly,
      seriesId: id,
      seriesIndex: 1,
      rotation: { memberIds, index },
    });

  it("unassigns their open tasks and leaves done tasks and others' tasks alone", () => {
    const tasks = [
      makeTask({ id: "mine", assigneeId: "anna" }),
      makeTask({ id: "done", assigneeId: "anna", status: "done" }),
      makeTask({ id: "other", assigneeId: "nevio" }),
      makeTask({ id: "nobody", assigneeId: null }),
    ];
    expect(memberCleanup(tasks, "anna")).toEqual([{ taskId: "mine", assigneeId: null }]);
  });

  it("keeps the same person up when the leaver sits before the index", () => {
    // Nevio, Anna, Mia; Mia's turn (2). Nevio leaves → Anna, Mia; still Mia (1).
    expect(memberCleanup([rotating(["nevio", "anna", "mia"], 2)], "nevio")).toEqual([
      { taskId: "t", assigneeId: "mia", rotation: { memberIds: ["anna", "mia"], index: 1 } },
    ]);
  });

  it("gives the leaver's turn to the next person", () => {
    // Anna's turn (1). Anna leaves → Nevio, Mia; Mia is next (1).
    expect(memberCleanup([rotating(["nevio", "anna", "mia"], 1)], "anna")).toEqual([
      { taskId: "t", assigneeId: "mia", rotation: { memberIds: ["nevio", "mia"], index: 1 } },
    ]);
  });

  it("wraps to the start when the leaver was last and up", () => {
    expect(memberCleanup([rotating(["nevio", "anna", "mia"], 2)], "mia")).toEqual([
      { taskId: "t", assigneeId: "nevio", rotation: { memberIds: ["nevio", "anna"], index: 0 } },
    ]);
  });

  it("keeps index and assignee when the leaver sits after the index", () => {
    expect(memberCleanup([rotating(["nevio", "anna", "mia"], 0)], "mia")).toEqual([
      { taskId: "t", assigneeId: "nevio", rotation: { memberIds: ["nevio", "anna"], index: 0 } },
    ]);
  });

  it("always keeps assigneeId == memberIds[index]", () => {
    const ids = ["a", "b", "c", "d"];
    for (let index = 0; index < ids.length; index++) {
      for (const leaver of ids) {
        const [change] = memberCleanup([rotating(ids, index)], leaver);
        expect(change.rotation).toBeTruthy();
        expect(change.assigneeId).toBe(change.rotation!.memberIds[change.rotation!.index]);
        expect(change.rotation!.memberIds).not.toContain(leaver);
      }
    }
  });

  it("drops a rotation of fewer than two and unassigns it if it was theirs", () => {
    expect(memberCleanup([rotating(["nevio", "anna"], 1)], "anna")).toEqual([
      { taskId: "t", assigneeId: null, rotation: null },
    ]);
    expect(memberCleanup([rotating(["nevio", "anna"], 0)], "anna")).toEqual([
      { taskId: "t", assigneeId: "nevio", rotation: null },
    ]);
  });

  it("leaves rotations without the leaver alone", () => {
    expect(memberCleanup([rotating(["nevio", "anna"], 0)], "mia")).toEqual([]);
  });
});

describe("rotationOrderWithout", () => {
  it("removes the member or says there's nothing to change", () => {
    const household = makeHousehold({ rotationOrder: ["nevio", "anna", "mia"] });
    expect(rotationOrderWithout(household, "anna")).toEqual(["nevio", "mia"]);
    expect(rotationOrderWithout(household, "lea")).toBeUndefined();
    expect(rotationOrderWithout(makeHousehold(), "anna")).toBeUndefined();
  });
});
