import { useEffect, useState } from "react";

/**
 * The current time, re-rendering every `intervalMs` (default a minute) and when the tab becomes
 * visible again. For text that changes with the clock: the greeting, «Gerade eben» (Phase 8 B8).
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") update();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);

  return now;
}
