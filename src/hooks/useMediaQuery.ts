import { useSyncExternalStore } from "react";

/** Tailwind's `lg` breakpoint, where the layouts switch to desktop. */
export const DESKTOP_QUERY = "(min-width: 64rem)";

/**
 * Whether a media query matches, live. False where `matchMedia` doesn't exist (tests).
 * Prefer CSS (`lg:`) for layout; use this only where a prop or text differs per viewport.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => typeof window.matchMedia === "function" && window.matchMedia(query).matches,
    () => false,
  );
}

/** True from the `lg` breakpoint on (desktop layout). */
export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}
