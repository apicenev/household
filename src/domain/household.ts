import type { Household, Member } from "../types";

/** Longest household name the rules accept. */
export const MAX_HOUSEHOLD_NAME = 50;

/** Owner first, then by join date (oldest first), then by name. */
export function sortMembers(members: readonly Member[]): Member[] {
  return [...members].sort((a, b) => {
    if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
    const byDate = a.joinedAt.getTime() - b.joinedAt.getTime();
    if (byDate !== 0) return byDate;
    return a.displayName.localeCompare(b.displayName, "de-CH");
  });
}

export function isOwner(household: Pick<Household, "ownerId">, uid: string): boolean {
  return household.ownerId === uid;
}

export type HouseholdNameError = "empty" | "tooLong";

/** Trimmed name, or why it isn't valid (1–50 characters). */
export function validateHouseholdName(
  input: string,
): { ok: true; name: string } | { ok: false; error: HouseholdNameError } {
  const name = input.trim();
  if (name.length === 0) return { ok: false, error: "empty" };
  if (name.length > MAX_HOUSEHOLD_NAME) return { ok: false, error: "tooLong" };
  return { ok: true, name };
}
