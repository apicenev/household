/** Firestore error code of a failed read or write, if any. */
export function firestoreErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code } = error as { code: unknown };
    return typeof code === "string" ? code.replace(/^firestore\//, "") : undefined;
  }
  return undefined;
}

/** True when the request failed because there's no (real) connection. */
export function isOfflineError(error: unknown): boolean {
  return firestoreErrorCode(error) === "unavailable";
}

/** German message for a failed Firestore write. */
export function firestoreErrorMessage(error: unknown): string {
  switch (firestoreErrorCode(error)) {
    case "unavailable":
      return "Keine Verbindung. Prüf dein Internet und versuch es nochmals.";
    case "permission-denied":
      return "Dazu hast du keine Berechtigung.";
    default:
      return "Das hat nicht geklappt. Versuch es nochmals.";
  }
}
