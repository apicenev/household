import { describe, expect, it } from "vitest";
import { avatarColorFor, initialsFor } from "./member";

describe("initialsFor", () => {
  it("uses the first letters of the first and last word", () => {
    expect(initialsFor("Nevio Apicella")).toBe("NA");
    expect(initialsFor("Anna Maria Muster")).toBe("AM");
  });

  it("uses the first two letters of a single word", () => {
    expect(initialsFor("Anna")).toBe("AN");
    expect(initialsFor("nevio")).toBe("NE");
  });

  it("handles extra whitespace, umlauts and one-letter names", () => {
    expect(initialsFor("  Jürg   Öhler ")).toBe("JÖ");
    expect(initialsFor("X")).toBe("X");
    expect(initialsFor("   ")).toBe("?");
  });
});

describe("avatarColorFor", () => {
  it("is stable per uid and always between 1 and 8", () => {
    const uids = ["rOIoJ3NhRdksfrue74Oqq6cxzMbT", "az46amLxdf1ddNm0tzPGAO0nsX6z", "a", ""];
    for (const uid of uids) {
      const color = avatarColorFor(uid);
      expect(color).toBe(avatarColorFor(uid));
      expect(color).toBeGreaterThanOrEqual(1);
      expect(color).toBeLessThanOrEqual(8);
      expect(Number.isInteger(color)).toBe(true);
    }
  });

  it("spreads uids over the palette", () => {
    const colors = new Set(Array.from({ length: 64 }, (_, i) => avatarColorFor(`user-${i}`)));
    expect(colors.size).toBeGreaterThanOrEqual(6);
  });
});
