import { describe, expect, it } from "vitest";
import { taskCopy } from "./copy";

describe("taskCopy", () => {
  it("names everyone the deleted task disappears for (D22)", () => {
    expect(taskCopy.deleteText(["Nevio"])).toBe("Die Aufgabe wird gelöscht.");
    expect(taskCopy.deleteText(["Nevio", "Anna"])).toBe(
      "Die Aufgabe verschwindet für Nevio und Anna.",
    );
    expect(taskCopy.deleteText(["Nevio", "Anna", "Mia"])).toBe(
      "Die Aufgabe verschwindet für Nevio, Anna und Mia.",
    );
  });

  it("uses «…» quotes and the designed wording", () => {
    expect(taskCopy.completedToast("Bad putzen")).toBe("«Bad putzen» erledigt");
    expect(taskCopy.deleteTitle("Bad putzen")).toBe("«Bad putzen» löschen?");
    expect(taskCopy.addedStatus("Milch")).toBe("«Milch» zu den Aufgaben hinzugefügt");
    expect(taskCopy.summary(5, 1, 2)).toBe("5 offen · 1 überfällig · 2 heute fällig");
  });
});
