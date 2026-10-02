import { describe, expect, it } from "vitest";
import { firestoreErrorCode, firestoreErrorMessage, isOfflineError } from "./firestoreErrors";

describe("firestoreErrors", () => {
  it("reads the code with or without the firestore/ prefix", () => {
    expect(firestoreErrorCode({ code: "permission-denied" })).toBe("permission-denied");
    expect(firestoreErrorCode({ code: "firestore/unavailable" })).toBe("unavailable");
    expect(firestoreErrorCode(new Error("x"))).toBeUndefined();
    expect(firestoreErrorCode(null)).toBeUndefined();
  });

  it("detects offline errors", () => {
    expect(isOfflineError({ code: "unavailable" })).toBe(true);
    expect(isOfflineError({ code: "permission-denied" })).toBe(false);
  });

  it("maps codes to German messages", () => {
    expect(firestoreErrorMessage({ code: "unavailable" })).toBe(
      "Keine Verbindung. Prüf dein Internet und versuch es nochmals.",
    );
    expect(firestoreErrorMessage({ code: "permission-denied" })).toBe(
      "Dazu hast du keine Berechtigung.",
    );
    expect(firestoreErrorMessage(new Error("boom"))).toBe(
      "Das hat nicht geklappt. Versuch es nochmals.",
    );
  });
});
