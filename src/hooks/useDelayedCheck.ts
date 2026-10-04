import { useCallback, useEffect, useRef, useState } from "react";

/** The window in which a second tap cancels a check-off (Phase 3 B6, Phase 5 B6). */
export const CHECK_OFF_DELAY_MS = 700;

/**
 * One-tap check-off with a short undo window (UI-06), shared by tasks and shopping: the row
 * shows the tick at once; after 700 ms `finish(id)` runs. A second tap within the 700 ms
 * cancels. Leaving the page within the 700 ms finishes the pending ones right away, so a tick
 * the user saw is never lost. `finish` may change between renders; the latest one runs.
 */
export function useDelayedCheck(finish: (id: string) => void) {
  const [checking, setChecking] = useState<ReadonlySet<string>>(() => new Set());
  const timers = useRef(new Map<string, number>());

  const latestFinish = useRef(finish);
  useEffect(() => {
    latestFinish.current = finish;
  });

  const toggle = useCallback((id: string) => {
    const pending = timers.current.get(id);
    if (pending !== undefined) {
      window.clearTimeout(pending);
      timers.current.delete(id);
      setChecking((current) => without(current, id));
      return;
    }
    setChecking((current) => new Set(current).add(id));
    timers.current.set(
      id,
      window.setTimeout(() => {
        timers.current.delete(id);
        setChecking((current) => without(current, id));
        latestFinish.current(id);
      }, CHECK_OFF_DELAY_MS),
    );
  }, []);

  // Leaving the page: write what the user ticked (only a second tap cancels).
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const [id, timer] of pending) {
        window.clearTimeout(timer);
        latestFinish.current(id);
      }
      pending.clear();
    };
  }, []);

  return { checking, toggle };
}

function without(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(set);
  next.delete(id);
  return next;
}
