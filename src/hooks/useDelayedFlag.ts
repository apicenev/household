import { useEffect, useState } from "react";

/**
 * True once `flag` has been true for `delayMs` without interruption; false as soon as it
 * turns false. Used for «Sync läuft» (Phase 3 B14), so writes the server confirms quickly
 * don't flicker.
 */
export function useDelayedFlag(flag: boolean, delayMs: number): boolean {
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    if (!flag) return;
    const timer = window.setTimeout(() => setDelayed(true), delayMs);
    return () => {
      window.clearTimeout(timer);
      setDelayed(false);
    };
  }, [flag, delayMs]);

  return flag && delayed;
}
