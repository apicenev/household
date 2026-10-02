/**
 * Curated time zones for the household settings (HH-07, decision B6).
 * firestore.rules mirrors the ids (validTimeZone); a rules test keeps the two in sync.
 */
export const TIME_ZONES = [
  { id: "Europe/Zurich", label: "Europa/Zürich" },
  { id: "Europe/Berlin", label: "Europa/Berlin" },
  { id: "Europe/Vienna", label: "Europa/Wien" },
  { id: "Europe/Rome", label: "Europa/Rom" },
  { id: "Europe/Paris", label: "Europa/Paris" },
  { id: "Europe/London", label: "Europa/London" },
  { id: "Europe/Lisbon", label: "Europa/Lissabon" },
  { id: "America/New_York", label: "Amerika/New York" },
  { id: "Asia/Tokyo", label: "Asien/Tokio" },
] as const;

export type TimeZoneId = (typeof TIME_ZONES)[number]["id"];

export const DEFAULT_HOUSEHOLD_TIME_ZONE: TimeZoneId = "Europe/Zurich";

export function isKnownTimeZone(id: string): id is TimeZoneId {
  return TIME_ZONES.some((zone) => zone.id === id);
}

/** Short zone name at `now` in de-CH: «MEZ» / «MESZ»; «GMT-4» where German has none. */
function abbreviationAt(id: string, now: Date): string {
  const part = new Intl.DateTimeFormat("de-CH", { timeZone: id, timeZoneName: "short" })
    .formatToParts(now)
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? "";
}

/**
 * German label for a zone: «Europa/Zürich», or with the abbreviation valid at `now`:
 * «Europa/Zürich (MESZ)». Unknown ids fall back to the id itself.
 */
export function timeZoneLabel(
  id: string,
  now: Date = new Date(),
  { abbreviation = false }: { abbreviation?: boolean } = {},
): string {
  const label = TIME_ZONES.find((zone) => zone.id === id)?.label ?? id;
  if (!abbreviation) return label;
  const short = abbreviationAt(id, now);
  return short ? `${label} (${short})` : label;
}
