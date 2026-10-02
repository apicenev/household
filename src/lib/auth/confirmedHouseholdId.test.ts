import { describe, expect, it } from "vitest";
import type { UserProfile } from "../../types";
import { nextConfirmedHouseholdId } from "./confirmedHouseholdId";

const profile = (householdId?: string): UserProfile => ({
  uid: "nevio",
  displayName: "Nevio",
  email: "nevio@example.ch",
  initials: "NE",
  avatarColor: 3,
  householdId,
  createdAt: new Date(),
});

describe("nextConfirmedHouseholdId", () => {
  it("takes the value of a snapshot without pending writes", () => {
    expect(nextConfirmedHouseholdId(undefined, profile(), false)).toBeNull();
    expect(nextConfirmedHouseholdId(undefined, profile("h1"), false)).toBe("h1");
    expect(nextConfirmedHouseholdId(null, profile("h1"), false)).toBe("h1");
  });

  it("keeps the previous value while a create or join is pending", () => {
    expect(nextConfirmedHouseholdId(null, profile("h1"), true)).toBeNull();
    expect(nextConfirmedHouseholdId(undefined, profile("h1"), true)).toBeUndefined();
  });

  it("keeps the household during a pending profile edit", () => {
    expect(nextConfirmedHouseholdId("h1", profile("h1"), true)).toBe("h1");
  });

  it("counts a pending null as confirmed when nothing is known yet (first login offline)", () => {
    expect(nextConfirmedHouseholdId(undefined, profile(), true)).toBeNull();
  });

  it("keeps the previous value while the profile doesn't exist", () => {
    expect(nextConfirmedHouseholdId(undefined, null, false)).toBeUndefined();
    expect(nextConfirmedHouseholdId("h1", null, false)).toBe("h1");
  });

  it("rolls back to the confirmed value when a rejected write is undone", () => {
    let confirmed = nextConfirmedHouseholdId(undefined, profile(), false);
    confirmed = nextConfirmedHouseholdId(confirmed, profile("h1"), true);
    confirmed = nextConfirmedHouseholdId(confirmed, profile(), false);
    expect(confirmed).toBeNull();
  });
});
