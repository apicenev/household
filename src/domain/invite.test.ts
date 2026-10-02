import { describe, expect, it } from "vitest";
import {
  INVITE_CODE_LETTERS,
  cryptoRandomInt,
  generateInviteCode,
  inviteExpiresAt,
  isInviteExpired,
  isValidInviteCodeFormat,
  normalizeInviteCode,
} from "./invite";

describe("generateInviteCode", () => {
  it("has the format ABC-1234 without I or O", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateInviteCode();
      expect(code).toMatch(/^[A-HJ-NP-Z]{3}-\d{4}$/);
    }
  });

  it("uses the injected random source", () => {
    const values = [0, 1, 23, 4, 8, 2, 1];
    let i = 0;
    expect(generateInviteCode(() => values[i++])).toBe("ABZ-4821");
  });

  it("covers the whole alphabet", () => {
    expect(INVITE_CODE_LETTERS).toHaveLength(24);
    expect(INVITE_CODE_LETTERS).not.toMatch(/[IO]/);
  });
});

describe("cryptoRandomInt", () => {
  it("stays within [0, max)", () => {
    for (let i = 0; i < 200; i++) {
      const value = cryptoRandomInt(24);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(24);
    }
  });
});

describe("normalizeInviteCode", () => {
  it("uppercases, strips spaces and inserts the dash", () => {
    expect(normalizeInviteCode(" mst4821 ")).toBe("MST-4821");
    expect(normalizeInviteCode("mst-4821")).toBe("MST-4821");
    expect(normalizeInviteCode("M S T 4 8 2 1")).toBe("MST-4821");
  });

  it("keeps partial input as typed", () => {
    expect(normalizeInviteCode("")).toBe("");
    expect(normalizeInviteCode("ms")).toBe("MS");
    expect(normalizeInviteCode("mst")).toBe("MST");
    expect(normalizeInviteCode("mst-")).toBe("MST");
    expect(normalizeInviteCode("mst4")).toBe("MST-4");
  });

  it("cuts off extra characters", () => {
    expect(normalizeInviteCode("MST-48219")).toBe("MST-4821");
  });
});

describe("isValidInviteCodeFormat", () => {
  it("accepts complete codes only", () => {
    expect(isValidInviteCodeFormat("MST-4821")).toBe(true);
    expect(isValidInviteCodeFormat("MST-482")).toBe(false);
    expect(isValidInviteCodeFormat("MST4821")).toBe(false);
    expect(isValidInviteCodeFormat("mst-4821")).toBe(false);
    expect(isValidInviteCodeFormat("MS1-4821")).toBe(false);
  });
});

describe("invite expiry", () => {
  const createdAt = new Date("2026-09-30T10:00:00Z");

  it("expires exactly 7 days after creation", () => {
    expect(inviteExpiresAt(createdAt)).toEqual(new Date("2026-10-07T10:00:00Z"));
  });

  it("is valid until just before the expiry and expired from it on", () => {
    expect(isInviteExpired(createdAt, new Date("2026-10-07T09:59:59.999Z"))).toBe(false);
    expect(isInviteExpired(createdAt, new Date("2026-10-07T10:00:00Z"))).toBe(true);
    expect(isInviteExpired(createdAt, new Date("2026-10-08T00:00:00Z"))).toBe(true);
    expect(isInviteExpired(createdAt, createdAt)).toBe(false);
  });
});
