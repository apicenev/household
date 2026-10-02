/**
 * Invite codes (HH-02, HH-03): three letters, a dash, four digits, e.g. «MST-4821».
 * Letters exclude I and O so they can't be confused with 1 and 0.
 */

export const INVITE_CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

/** How long a code stays valid after it was created (HH-03). */
export const INVITE_VALIDITY_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Uniform random integer in [0, max). */
export type RandomInt = (max: number) => number;

/** Cryptographically random integer in [0, max), without modulo bias. */
export const cryptoRandomInt: RandomInt = (max) => {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % max;
};

/** A new random code, e.g. «MST-4821». */
export function generateInviteCode(random: RandomInt = cryptoRandomInt): string {
  let letters = "";
  for (let i = 0; i < 3; i++) letters += INVITE_CODE_LETTERS[random(INVITE_CODE_LETTERS.length)];
  let digits = "";
  for (let i = 0; i < 4; i++) digits += String(random(10));
  return `${letters}-${digits}`;
}

/**
 * Normalises typed input while typing: uppercase, spaces and dashes removed, at most seven
 * characters, a dash after the third. « mst4821 » → «MST-4821», «ms» → «MS».
 */
export function normalizeInviteCode(input: string): string {
  const compact = input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 7);
  return compact.length > 3 ? `${compact.slice(0, 3)}-${compact.slice(3)}` : compact;
}

/** True for a complete code in the format ABC-1234 (whether or not it exists). */
export function isValidInviteCodeFormat(code: string): boolean {
  return /^[A-Z]{3}-\d{4}$/.test(code);
}

/** When a code created at `createdAt` stops working. */
export function inviteExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + INVITE_VALIDITY_DAYS * DAY_MS);
}

/** True from the exact moment of expiry on (the rules accept a join only before it). */
export function isInviteExpired(createdAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= inviteExpiresAt(createdAt).getTime();
}
