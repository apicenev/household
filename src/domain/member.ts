import type { AvatarColor } from "../types";

/**
 * Initials for the avatar: first letters of the first and last word, or the first two letters
 * of a single word. «Nevio Apicella» → «NA», «Anna» → «AN».
 */
export function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters =
    words.length === 1
      ? Array.from(words[0]).slice(0, 2)
      : [Array.from(words[0])[0], Array.from(words[words.length - 1])[0]];
  return letters.join("").toLocaleUpperCase("de-CH");
}

/** Stable default avatar colour (1–8) derived from the uid; members can change it later. */
export function avatarColorFor(uid: string): AvatarColor {
  let hash = 0;
  for (const char of uid) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return ((hash % 8) + 1) as AvatarColor;
}

/** Trimmed display name, or why it isn't valid: same rules as household names (1–50). */
export { validateHouseholdName as validateDisplayName } from "./household";
