/** Firebase Auth error codes that mean "these credentials don't work". */
const credentialCodes = new Set([
  "auth/invalid-credential",
  "auth/wrong-password",
  "auth/user-not-found",
  "auth/invalid-email",
  "auth/invalid-login-credentials",
]);

function codeOf(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code } = error as { code: unknown };
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

/** True when the email/password combination was rejected (fields are marked invalid). */
export function isCredentialError(error: unknown): boolean {
  const code = codeOf(error);
  return code !== undefined && credentialCodes.has(code);
}

/** German message for a failed login (AUTH-04). */
export function authErrorMessage(error: unknown): string {
  const code = codeOf(error);
  if (code && credentialCodes.has(code)) return "E-Mail oder Passwort ist falsch.";
  switch (code) {
    case "auth/user-disabled":
      return "Dieses Konto ist deaktiviert.";
    case "auth/too-many-requests":
      return "Zu viele Versuche. Warte kurz und versuch es nochmals.";
    case "auth/network-request-failed":
      return "Keine Verbindung. Prüf dein Internet und versuch es nochmals.";
    default:
      return "Etwas ist schiefgelaufen. Versuch es nochmals.";
  }
}
