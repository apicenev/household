import { describe, expect, it } from "vitest";
import { authErrorMessage, isCredentialError } from "./authErrors";

const err = (code: string) => ({ code, message: code });

describe("authErrorMessage", () => {
  it.each([
    "auth/invalid-credential",
    "auth/wrong-password",
    "auth/user-not-found",
    "auth/invalid-email",
  ])("maps %s to the credentials message", (code) => {
    expect(authErrorMessage(err(code))).toBe("E-Mail oder Passwort ist falsch.");
    expect(isCredentialError(err(code))).toBe(true);
  });

  it.each([
    ["auth/user-disabled", "Dieses Konto ist deaktiviert."],
    ["auth/too-many-requests", "Zu viele Versuche. Warte kurz und versuch es nochmals."],
    [
      "auth/network-request-failed",
      "Keine Verbindung. Prüf dein Internet und versuch es nochmals.",
    ],
    ["auth/internal-error", "Etwas ist schiefgelaufen. Versuch es nochmals."],
  ])("maps %s", (code, message) => {
    expect(authErrorMessage(err(code))).toBe(message);
    expect(isCredentialError(err(code))).toBe(false);
  });

  it("falls back for errors without a code", () => {
    expect(authErrorMessage(new Error("boom"))).toBe(
      "Etwas ist schiefgelaufen. Versuch es nochmals.",
    );
    expect(authErrorMessage(undefined)).toBe("Etwas ist schiefgelaufen. Versuch es nochmals.");
    expect(isCredentialError(null)).toBe(false);
  });
});
