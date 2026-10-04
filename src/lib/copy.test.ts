import { describe, expect, it } from "vitest";
import { calendarCopy, shoppingCopy, taskCopy } from "./copy";

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

describe("calendarCopy", () => {
  it("counts events and days", () => {
    expect(calendarCopy.eventCount(1)).toBe("1 Termin");
    expect(calendarCopy.eventCount(2)).toBe("2 Termine");
    expect(calendarCopy.days(1)).toBe("1 Tag");
    expect(calendarCopy.days(8)).toBe("8 Tage");
    expect(calendarCopy.dayOf(3, 8)).toBe("Tag 3 von 8");
    expect(calendarCopy.more(2)).toBe("+2 weitere");
  });

  it("labels day cells as designed (D57)", () => {
    expect(calendarCopy.cellLabel("Sa., 3. Okt.", true, 2)).toBe("Sa., 3. Okt., heute, 2 Termine");
    expect(calendarCopy.cellLabel("Mi., 14. Okt.", false, 1)).toBe("Mi., 14. Okt., 1 Termin");
    expect(calendarCopy.cellLabel("Do., 15. Okt.", false, 0)).toBe("Do., 15. Okt., keine Termine");
  });

  it("builds the D55 labels and meta lines", () => {
    expect(calendarCopy.until("Sa.")).toBe("bis Sa.");
    expect(calendarCopy.until("02:00")).toBe("bis 02:00");
    expect(calendarCopy.meta(calendarCopy.noRepeat, "19:30–22:30")).toBe(
      "Wiederholt sich nicht · 19:30–22:30",
    );
    expect(calendarCopy.meta("Mi., 14. – Mi., 21. Okt.", "8 Tage", "", "Alle")).toBe(
      "Mi., 14. – Mi., 21. Okt. · 8 Tage · Alle",
    );
  });

  it("names everyone the deleted event disappears for (D53)", () => {
    expect(calendarCopy.deleteTitle("Arzttermin")).toBe("«Arzttermin» löschen?");
    expect(calendarCopy.deleteText(["Nevio"])).toBe("Der Termin wird gelöscht.");
    expect(calendarCopy.deleteText(["Nevio", "Anna"])).toBe(
      "Der Termin verschwindet für Nevio und Anna.",
    );
  });

  it("uses «…» quotes and has no «ß»", () => {
    expect(calendarCopy.addedStatus("Znacht")).toBe("«Znacht» zum Kalender hinzugefügt");
    const strings = Object.values(calendarCopy).filter((v) => typeof v === "string");
    expect(strings.join(" ")).not.toContain("ß");
  });
});
