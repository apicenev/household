import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useToday } from "./useToday";

afterEach(() => {
  vi.useRealTimers();
});

describe("useToday", () => {
  it("is today in the household time zone and rolls over at its midnight", () => {
    // 23:30 in Zurich (CEST) on 30 Sept is 21:30 UTC.
    vi.useFakeTimers({ now: new Date("2026-09-30T21:30:00Z") });
    const { result } = renderHook(() => useToday("Europe/Zurich"));
    expect(result.current).toBe("2026-09-30");
    act(() => vi.advanceTimersByTime(29 * 60 * 1000));
    expect(result.current).toBe("2026-09-30");
    act(() => vi.advanceTimersByTime(2 * 60 * 1000));
    expect(result.current).toBe("2026-10-01");
    // And again a day later.
    act(() => vi.advanceTimersByTime(24 * 60 * 60 * 1000));
    expect(result.current).toBe("2026-10-02");
  });

  it("follows another household time zone", () => {
    vi.useFakeTimers({ now: new Date("2026-09-30T21:30:00Z") });
    const { result } = renderHook(() => useToday("America/New_York"));
    expect(result.current).toBe("2026-09-30");
  });

  it("updates when the tab becomes visible again", () => {
    vi.useFakeTimers({ now: new Date("2026-09-30T10:00:00Z") });
    const { result } = renderHook(() => useToday("Europe/Zurich"));
    vi.setSystemTime(new Date("2026-10-03T10:00:00Z"));
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(result.current).toBe("2026-10-03");
  });
});
