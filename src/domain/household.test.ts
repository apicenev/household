import { describe, expect, it } from "vitest";
import type { Member } from "../types";
import { isOwner, sortMembers, validateHouseholdName } from "./household";

function member(uid: string, role: Member["role"], joinedAt: string, displayName = uid): Member {
  return {
    uid,
    displayName,
    initials: "XX",
    avatarColor: 1,
    role,
    joinedAt: new Date(joinedAt),
  };
}

describe("sortMembers", () => {
  it("puts the owner first, then sorts by join date", () => {
    const members = [
      member("lea", "member", "2026-10-03"),
      member("anna", "member", "2026-10-02"),
      member("nevio", "owner", "2026-10-05"),
    ];
    expect(sortMembers(members).map((m) => m.uid)).toEqual(["nevio", "anna", "lea"]);
  });

  it("sorts by name on equal join dates and doesn't mutate the input", () => {
    const members = [
      member("b", "member", "2026-10-02", "Zora"),
      member("a", "member", "2026-10-02", "Ändu"),
    ];
    expect(sortMembers(members).map((m) => m.displayName)).toEqual(["Ändu", "Zora"]);
    expect(members[0].uid).toBe("b");
  });
});

describe("isOwner", () => {
  it("compares the owner id", () => {
    expect(isOwner({ ownerId: "nevio" }, "nevio")).toBe(true);
    expect(isOwner({ ownerId: "nevio" }, "anna")).toBe(false);
  });
});

describe("validateHouseholdName", () => {
  it("trims and accepts 1–50 characters", () => {
    expect(validateHouseholdName("  WG Linde ")).toEqual({ ok: true, name: "WG Linde" });
    expect(validateHouseholdName("x".repeat(50))).toEqual({ ok: true, name: "x".repeat(50) });
  });

  it("rejects empty and too long names", () => {
    expect(validateHouseholdName("   ")).toEqual({ ok: false, error: "empty" });
    expect(validateHouseholdName("x".repeat(51))).toEqual({ ok: false, error: "tooLong" });
  });
});
