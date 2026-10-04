import { describe, expect, it } from "vitest";
import { shoppingCopy, taskCopy } from "./copy";

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

describe("shoppingCopy", () => {
  it("names who the list is shared with (D42)", () => {
    expect(shoppingCopy.summary(4, 4, [])).toBe("4 offen · 4 im Wagen");
    expect(shoppingCopy.summary(4, 4, ["Anna"])).toBe("4 offen · 4 im Wagen · mit Anna geteilt");
    expect(shoppingCopy.summary(1, 0, ["Anna", "Mia"])).toBe(
      "1 offen · 0 im Wagen · mit Anna und Mia geteilt",
    );
    expect(shoppingCopy.summary(1, 0, ["Anna", "Mia", "Lea"])).toBe(
      "1 offen · 0 im Wagen · mit Anna, Mia und 1 weiteren Person geteilt",
    );
    expect(shoppingCopy.summary(1, 0, ["Anna", "Mia", "Lea", "Tim"])).toBe(
      "1 offen · 0 im Wagen · mit Anna, Mia und 2 weiteren Personen geteilt",
    );
  });

  it("uses «…» quotes and the designed wording", () => {
    expect(shoppingCopy.openCount(4)).toBe("4 offen");
    expect(shoppingCopy.openCount(0)).toBe("Alles erledigt");
    expect(shoppingCopy.addRow("Mi")).toBe("«Mi» hinzufügen");
    expect(shoppingCopy.timesBought(12)).toBe("12× gekauft");
    expect(shoppingCopy.boughtSection(4)).toBe("Gekauft (4)");
    expect(shoppingCopy.boughtBy("Anna")).toBe("von Anna");
    expect(shoppingCopy.purchasedToast("Milch")).toBe("«Milch» gekauft");
    expect(shoppingCopy.clearedToast(3)).toBe("3 Artikel entfernt");
    expect(shoppingCopy.duplicateHint("Milch")).toBe("Milch steht schon auf der Liste.");
    expect(shoppingCopy.addedStatus("Milch")).toBe("«Milch» zum Einkauf hinzugefügt");
    expect(shoppingCopy.checkLabel("Milch")).toBe("Milch als gekauft markieren");
    expect(shoppingCopy.uncheckLabel("Milch")).toBe("Milch zurück auf die Liste");
  });

  it("has no «ß»", () => {
    const strings = Object.values(shoppingCopy).filter((v) => typeof v === "string");
    expect(strings.join(" ")).not.toContain("ß");
  });
});
