import { tz } from "@date-fns/tz";
import { getHours } from "date-fns";

/**
 * Time-of-day greeting for the dashboard (Phase 8):
 * «Guten Morgen» 05–11, «Guten Tag» 11–18, «Guten Abend» 18–05 (local time in `timeZone`).
 */
export function greeting(now: Date, timeZone = "Europe/Zurich"): string {
  const hour = getHours(now, { in: tz(timeZone) });
  if (hour >= 5 && hour < 11) return "Guten Morgen";
  if (hour >= 11 && hour < 18) return "Guten Tag";
  return "Guten Abend";
}
