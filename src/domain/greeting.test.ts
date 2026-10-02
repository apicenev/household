import { describe, expect, it } from "vitest";
import { greeting } from "./greeting";

// Zurich is UTC+2 on these (summer) dates.
const at = (localHour: number, minute = 0) =>
  new Date(Date.UTC(2026, 8, 30, localHour - 2, minute));

describe("greeting", () => {
  it("says «Guten Morgen» from 05:00 to 10:59", () => {
    expect(greeting(at(5))).toBe("Guten Morgen");
    expect(greeting(at(10, 59))).toBe("Guten Morgen");
  });

  it("says «Guten Tag» from 11:00 to 17:59", () => {
    expect(greeting(at(11))).toBe("Guten Tag");
    expect(greeting(at(17, 59))).toBe("Guten Tag");
  });

  it("says «Guten Abend» from 18:00 to 04:59", () => {
    expect(greeting(at(18))).toBe("Guten Abend");
    expect(greeting(at(23, 59))).toBe("Guten Abend");
    expect(greeting(at(4, 59))).toBe("Guten Abend");
  });

  it("uses the given time zone", () => {
    const utcSix = new Date(Date.UTC(2026, 8, 30, 6));
    expect(greeting(utcSix, "UTC")).toBe("Guten Morgen");
    expect(greeting(utcSix, "America/New_York")).toBe("Guten Abend"); // 02:00
  });
});
