import { useEffect, useState } from "react";
import { todayKey } from "../domain/tasks";

/** Milliseconds until the calendar day in `timeZone` changes (at most a minute late). */
function msUntilNextDay(now: Date, timeZone: string): number {
  const today = todayKey(now, timeZone);
  // Find the next minute whose date differs; time zones change days on the full hour or
  // half hour, so stepping by hours and then minutes is exact enough and DST-safe.
  let probe = now.getTime();
  const HOUR = 60 * 60 * 1000;
  while (todayKey(new Date(probe + HOUR), timeZone) === today) probe += HOUR;
  while (todayKey(new Date(probe), timeZone) === today) probe += 60 * 1000;
  return Math.max(probe - now.getTime(), 1000);
}

/**
 * Today's date key («2026-10-03») in the household time zone (Phase 3 B4). Re-renders at the
 * next midnight there and when the tab becomes visible again (a phone that slept overnight).
 */
export function useToday(timeZone: string): string {
  const [today, setToday] = useState(() => todayKey(new Date(), timeZone));

  useEffect(() => {
    const update = () => setToday(todayKey(new Date(), timeZone));
    update();
    let timer: number | undefined;
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          update();
          schedule();
        },
        msUntilNextDay(new Date(), timeZone),
      );
    };
    schedule();
    const onVisible = () => {
      if (document.visibilityState === "visible") update();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [timeZone]);

  return today;
}
