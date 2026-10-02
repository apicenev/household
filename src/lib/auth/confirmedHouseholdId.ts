import type { UserProfile } from "../../types";

/**
 * The household id the server has confirmed, given the previous value and a new profile
 * snapshot (Phase 2 §2.6):
 * - a snapshot without pending writes sets it (null = no household);
 * - while a write is pending, the previous confirmed value is kept, so a create or join only
 *   counts once the server has accepted the batch;
 * - exception: with nothing confirmed yet, a pending `null` (first login, profile creation
 *   queued offline) counts as confirmed, since onboarding is always the safe direction.
 *
 * `undefined` means «not known yet».
 */
export function nextConfirmedHouseholdId(
  previous: string | null | undefined,
  profile: UserProfile | null,
  hasPendingWrites: boolean,
): string | null | undefined {
  if (!profile) return previous;
  const householdId = profile.householdId ?? null;
  if (!hasPendingWrites) return householdId;
  if (previous === undefined && householdId === null) return null;
  return previous;
}
