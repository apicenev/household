/**
 * Notice for onboarding (Phase 9 D88): set when this device found that the member was removed
 * or the household deleted. The onboarding choice page shows it until the user moves on.
 * Kept in memory only: after a reload there's nothing to explain any more.
 */
let ended = false;

export function markHouseholdEnded(): void {
  ended = true;
}

/** Whether to show the notice (doesn't reset, so StrictMode's double render sees the same). */
export function isHouseholdEnded(): boolean {
  return ended;
}

export function clearHouseholdEnded(): void {
  ended = false;
}
