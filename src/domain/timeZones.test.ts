import { describe, expect, it } from "vitest";
import { TIME_ZONES, isKnownTimeZone, timeZoneLabel } from "./timeZones";

const january = new Date("2026-01-15T12:00:00Z");
const july = new Date("2026-07-15T12:00:00Z");

describe("TIME_ZONES", () => {
  it("contains only zones Intl knows, Zürich first", () => {
    expect(TIME_ZONES[0].id).toBe("Europe/Zurich");
    for (const zone of TIME_ZONES) {
      expect(() => new Intl.DateTimeFormat("de-CH", { timeZone: zone.id })).not.toThrow();
    }
  });

  it("recognises known ids", () => {
    expect(isKnownTimeZone("Europe/Vienna")).toBe(true);
    expect(isKnownTimeZone("Europe/Moscow")).toBe(false);
  });
});

describe("timeZoneLabel", () => {
  it("returns the German label without abbreviation by default", () => {
    expect(timeZoneLabel("Europe/Zurich", july)).toBe("Europa/Zürich");
    expect(timeZoneLabel("America/New_York", july)).toBe("Amerika/New York");
  });

  it("adds MEZ in winter and MESZ in summer for Zürich", () => {
    expect(timeZoneLabel("Europe/Zurich", january, { abbreviation: true })).toBe(
      "Europa/Zürich (MEZ)",
    );
    expect(timeZoneLabel("Europe/Zurich", july, { abbreviation: true })).toBe(
      "Europa/Zürich (MESZ)",
    );
  });

  it("adds an abbreviation or offset for the other zones", () => {
    // ICU output differs between Node and browser versions, so only the shape is checked.
    for (const zone of TIME_ZONES) {
      const label = timeZoneLabel(zone.id, july, { abbreviation: true });
      expect(label.startsWith(`${zone.label} (`)).toBe(true);
      expect(label).toMatch(/\((?:[A-Z]{2,5}|GMT[+-]\d{1,2}(?::\d{2})?)\)$/);
    }
    expect(timeZoneLabel("America/New_York", january, { abbreviation: true })).toMatch(
      /\((GMT-5|EST)\)$/,
    );
  });

  it("falls back to the id for unknown zones", () => {
    expect(timeZoneLabel("Europe/Moscow", july)).toBe("Europe/Moscow");
  });
});
