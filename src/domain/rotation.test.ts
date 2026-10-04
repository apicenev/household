import { describe, expect, it } from "vitest";
import {
  defaultRotationOrder,
  moveInOrder,
  nextAssignee,
  orderStartingWith,
  pruneRotation,
  rotationForEdit,
  rotationFromOrder,
  rotationOrder,
  sameRotation,
} from "./rotation";

const member = (uid: string, day: number) => ({ uid, joinedAt: new Date(Date.UTC(2026, 8, day)) });
const nevio = member("nevio", 1);
const anna = member("anna", 2);
const mia = member("mia", 3);

describe("nextAssignee (§8.3)", () => {
  it("alternates between two members", () => {
    const rotation = { memberIds: ["nevio", "anna"], index: 0 };
    const first = nextAssignee(rotation, ["nevio", "anna"]);
    expect(first).toEqual({
      rotation: { memberIds: ["nevio", "anna"], index: 1 },
      assigneeId: "anna",
    });
    expect(nextAssignee(first.rotation!, ["nevio", "anna"]).assigneeId).toBe("nevio");
  });

  it("cycles through three members and wraps around", () => {
    let rotation = { memberIds: ["nevio", "anna", "mia"], index: 0 };
    const order: string[] = [];
    for (let i = 0; i < 4; i++) {
      const next = nextAssignee(rotation, ["nevio", "anna", "mia"]);
      order.push(next.assigneeId!);
      rotation = next.rotation!;
    }
    expect(order).toEqual(["anna", "mia", "nevio", "anna"]);
  });

  it("skips and prunes a member who left (§8.4)", () => {
    const rotation = { memberIds: ["nevio", "anna", "mia"], index: 0 };
    expect(nextAssignee(rotation, ["nevio", "mia"])).toEqual({
      rotation: { memberIds: ["nevio", "mia"], index: 1 },
      assigneeId: "mia",
    });
  });

  it("goes on after the current assignee left", () => {
    const rotation = { memberIds: ["nevio", "anna", "mia"], index: 1 };
    expect(nextAssignee(rotation, ["nevio", "mia"])).toEqual({
      rotation: { memberIds: ["nevio", "mia"], index: 1 },
      assigneeId: "mia",
    });
  });

  it("ends the rotation when fewer than two members are left", () => {
    expect(nextAssignee({ memberIds: ["nevio", "anna"], index: 0 }, ["nevio"])).toEqual({
      rotation: null,
      assigneeId: "nevio",
    });
    expect(nextAssignee({ memberIds: ["nevio", "anna"], index: 0 }, [])).toEqual({
      rotation: null,
      assigneeId: null,
    });
  });
});

describe("pruneRotation («Nur diese», B8)", () => {
  it("keeps the current assignee", () => {
    expect(
      pruneRotation({ memberIds: ["nevio", "anna", "mia"], index: 1 }, ["nevio", "anna", "mia"]),
    ).toEqual({
      rotation: { memberIds: ["nevio", "anna", "mia"], index: 1 },
      assigneeId: "anna",
    });
    expect(
      pruneRotation({ memberIds: ["nevio", "anna", "mia"], index: 2 }, ["anna", "mia"]),
    ).toEqual({
      rotation: { memberIds: ["anna", "mia"], index: 1 },
      assigneeId: "mia",
    });
  });

  it("hands over when the current assignee left, ends below two members", () => {
    expect(
      pruneRotation({ memberIds: ["nevio", "anna", "mia"], index: 1 }, ["nevio", "mia"]).assigneeId,
    ).toBe("mia");
    expect(pruneRotation({ memberIds: ["nevio", "anna"], index: 0 }, ["nevio"])).toEqual({
      rotation: null,
      assigneeId: "nevio",
    });
  });
});

describe("orders", () => {
  it("shows the rotation starting with the current assignee", () => {
    expect(rotationOrder({ memberIds: ["nevio", "anna", "mia"], index: 1 })).toEqual([
      "anna",
      "mia",
      "nevio",
    ]);
    expect(rotationFromOrder(["anna", "nevio"])).toEqual({
      memberIds: ["anna", "nevio"],
      index: 0,
    });
    expect(rotationFromOrder(["anna"])).toBeNull();
  });

  it("treats the same cycle with the same current assignee as equal", () => {
    expect(
      sameRotation(
        { memberIds: ["nevio", "anna"], index: 1 },
        { memberIds: ["anna", "nevio"], index: 0 },
      ),
    ).toBe(true);
    expect(
      sameRotation(
        { memberIds: ["nevio", "anna"], index: 0 },
        { memberIds: ["anna", "nevio"], index: 0 },
      ),
    ).toBe(false);
    expect(sameRotation(undefined, undefined)).toBe(true);
    expect(sameRotation({ memberIds: ["nevio", "anna"], index: 0 }, undefined)).toBe(false);
  });

  it("rotates to a member and moves entries", () => {
    expect(orderStartingWith(["nevio", "anna", "mia"], "mia")).toEqual(["mia", "nevio", "anna"]);
    expect(orderStartingWith(["nevio", "anna"], "lea")).toEqual(["nevio", "anna"]);
    expect(moveInOrder(["nevio", "anna", "mia"], 2, 0)).toEqual(["mia", "nevio", "anna"]);
    expect(moveInOrder(["nevio", "anna"], 0, 1)).toEqual(["anna", "nevio"]);
    expect(moveInOrder(["nevio", "anna"], 0, 2)).toEqual(["nevio", "anna"]);
  });
});

describe("defaultRotationOrder (B11) / rotationForEdit (B4)", () => {
  it("uses the household order, drops former members and appends new ones by joinedAt", () => {
    expect(defaultRotationOrder(["anna", "lea", "nevio"], [nevio, anna, mia], null)).toEqual([
      "anna",
      "nevio",
      "mia",
    ]);
    expect(defaultRotationOrder(undefined, [mia, anna, nevio], null)).toEqual([
      "nevio",
      "anna",
      "mia",
    ]);
    expect(defaultRotationOrder(["anna", "nevio"], [nevio, anna], "nevio")).toEqual([
      "nevio",
      "anna",
    ]);
  });

  it("shows a saved rotation with new members at the end and former ones gone", () => {
    expect(rotationForEdit({ memberIds: ["anna", "nevio"], index: 1 }, [nevio, anna, mia])).toEqual(
      ["nevio", "anna", "mia"],
    );
    expect(
      rotationForEdit({ memberIds: ["anna", "lea", "nevio"], index: 0 }, [nevio, anna]),
    ).toEqual(["anna", "nevio"]);
  });
});
