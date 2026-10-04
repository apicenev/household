import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/ToastProvider";
import { statKey } from "../domain/shopping";
import { AuthContext, type AuthContextValue } from "../lib/auth/useAuth";
import { AppRoutes } from "../router/AppRoutes";
import type { ItemStat, ShopCategory, ShoppingItem } from "../types";
import { fakeStore, makeItem, nevioProfile, shoppingServiceMock } from "./householdFakes";

vi.mock("../lib/firebase", () => ({ auth: {}, db: {} }));
vi.mock("../services/householdService", () =>
  import("./householdFakes").then((fakes) => fakes.householdServiceMock),
);
vi.mock("../services/memberService", () =>
  import("./householdFakes").then((fakes) => fakes.memberServiceMock),
);
vi.mock("../services/taskService", () =>
  import("./householdFakes").then((fakes) => fakes.taskServiceMock),
);
vi.mock("../services/shoppingService", () =>
  import("./householdFakes").then((fakes) => fakes.shoppingServiceMock),
);
vi.mock("../services/eventService", () =>
  import("./householdFakes").then((fakes) => fakes.eventServiceMock),
);

function renderShopping() {
  const auth: AuthContextValue = {
    user: { uid: nevioProfile.uid, email: nevioProfile.email },
    profile: nevioProfile,
    confirmedHouseholdId: "h1",
    initializing: false,
    login: vi.fn(),
    logout: vi.fn(),
  };
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={["/shopping"]}>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

// The lazy page can take more than findBy's default 1 s to load under full-suite load.
const page = () => screen.findByRole("heading", { name: "Einkauf", level: 1 }, { timeout: 3000 });
const field = () => screen.getByRole("combobox", { name: "Artikel hinzufügen" });
const openNames = () =>
  screen
    .queryAllByRole("checkbox", { name: / als gekauft markieren$/ })
    .map((box) => box.getAttribute("aria-label")?.replace(" als gekauft markieren", ""));
const groupHeadings = () =>
  screen
    .queryAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent)
    .filter((text) => text && /^(Lebensmittel|Haushalt|Apotheke|Sonstiges)/.test(text));

function mockDesktop(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function stat(name: string, count: number, category: ShopCategory = "groceries"): ItemStat {
  return {
    key: statKey(name),
    name,
    category,
    count,
    lastPurchasedAt: new Date("2026-09-20T10:00:00Z"),
  };
}

/** The prototype's list: open items in three groups, two bought by Anna. */
function exampleItems(): ShoppingItem[] {
  return [
    makeItem({ id: "milk", name: "Milch", quantity: "2 l" }),
    makeItem({ id: "coffee", name: "Kaffeebohnen", notes: "Ganze Bohnen, mittlere Röstung" }),
    makeItem({ id: "tabs", name: "Geschirrspültabs", category: "household", quantity: "1 Pack." }),
    makeItem({ id: "bulbs", name: "Glühbirnen E27", category: "other", quantity: "2" }),
    makeItem({
      id: "bread",
      name: "Brot",
      checked: true,
      checkedBy: "anna",
      checkedAt: new Date("2026-09-30T09:00:00Z"),
    }),
    makeItem({
      id: "eggs",
      name: "Eier",
      checked: true,
      checkedBy: "anna",
      checkedAt: new Date("2026-09-30T10:00:00Z"),
    }),
  ];
}

function exampleStats(): ItemStat[] {
  return [
    stat("Brot", 14),
    stat("Milch", 12),
    stat("Eier", 11),
    stat("Hafermilch", 9),
    stat("Tomaten", 8),
    stat("WC-Papier", 7, "household"),
    stat("Butter", 6),
    stat("Olivenöl", 5),
  ];
}

/** The service calls update the fake store like latency compensation. */
function optimisticWrites() {
  let created = 0;
  const update = (id: string, patch: Partial<ShoppingItem>) =>
    fakeStore.setItems(fakeStore.items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  shoppingServiceMock.addItem.mockImplementation((_hid, input) => {
    created += 1;
    const id = `new${created}`;
    fakeStore.setItems([...fakeStore.items, makeItem({ id, ...input })]);
    return { id, committed: Promise.resolve() };
  });
  shoppingServiceMock.readdItem.mockImplementation((_hid, old) => {
    created += 1;
    const id = `new${created}`;
    fakeStore.setItems([
      ...fakeStore.items.filter((i) => i.id !== old.id),
      makeItem({ id, name: old.name, category: old.category, quantity: old.quantity }),
    ]);
    return { id, committed: Promise.resolve() };
  });
  shoppingServiceMock.checkItem.mockImplementation(async (_hid, item, actorId) =>
    update(item.id, { checked: true, checkedAt: new Date(), checkedBy: actorId }),
  );
  shoppingServiceMock.uncheckItem.mockImplementation(async (_hid, item) =>
    update(item.id, { checked: false, checkedAt: undefined, checkedBy: undefined }),
  );
  shoppingServiceMock.clearCompleted.mockImplementation((_hid, items) => {
    const removed = items.filter((i) => i.checked);
    fakeStore.setItems(fakeStore.items.filter((i) => !i.checked));
    return { removed, committed: Promise.resolve() };
  });
  shoppingServiceMock.restoreItems.mockImplementation(async (_hid, items) => {
    fakeStore.setItems([...fakeStore.items, ...items]);
  });
  shoppingServiceMock.updateItem.mockImplementation(async (_hid, id, changes) =>
    update(id, {
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      ...(changes.category !== undefined ? { category: changes.category } : {}),
      ...(changes.quantity !== undefined ? { quantity: changes.quantity ?? undefined } : {}),
      ...(changes.notes !== undefined ? { notes: changes.notes ?? undefined } : {}),
    }),
  );
  shoppingServiceMock.deleteItem.mockImplementation(async (_hid, id) =>
    fakeStore.setItems(fakeStore.items.filter((i) => i.id !== id)),
  );
}

beforeAll(async () => {
  await import("../pages/ShoppingPage");
});

beforeEach(() => {
  fakeStore.reset();
  fakeStore.items = exampleItems();
  fakeStore.itemStats = exampleStats();
  for (const fn of Object.values(shoppingServiceMock)) {
    if (typeof fn === "function" && "mockReset" in fn) fn.mockReset();
  }
  optimisticWrites();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.title = "";
});

describe("Einkauf list", () => {
  it("groups open items by category in a fixed order, with notes and quantities", async () => {
    renderShopping();
    await page();
    await waitFor(() => expect(document.title).toBe("Einkauf – Household"));
    expect(groupHeadings()).toEqual(["Lebensmittel2", "Haushalt1", "Sonstiges1"]);
    expect(openNames()).toEqual(["Milch", "Kaffeebohnen", "Geschirrspültabs", "Glühbirnen E27"]);
    const milk = screen
      .getByRole("checkbox", { name: "Milch als gekauft markieren" })
      .closest("li")!;
    expect(milk).toHaveTextContent("2 l");
    const coffee = screen
      .getByRole("checkbox", { name: "Kaffeebohnen als gekauft markieren" })
      .closest("li")!;
    expect(coffee).toHaveTextContent("Ganze Bohnen, mittlere Röstung");
  });

  it("shows «Einkauf · 4 offen» in the top bar", async () => {
    renderShopping();
    await page();
    expect(screen.getByText("4 offen")).toBeInTheDocument();
  });

  it("shows «Alles im Wagen» and «Alles erledigt» when nothing is open", async () => {
    fakeStore.items = exampleItems().filter((i) => i.checked);
    renderShopping();
    await page();
    expect(screen.getByRole("heading", { name: "Alles im Wagen" })).toBeInTheDocument();
    expect(
      screen.getByText("Füge oben etwas hinzu oder wähle aus «Oft gekauft»."),
    ).toBeInTheDocument();
    expect(screen.getByText("Alles erledigt")).toBeInTheDocument();
    // «Gekauft» stays below.
    expect(screen.getByRole("button", { name: "Gekauft (2)" })).toBeInTheDocument();
  });

  it("shows a skeleton while loading, with the add field usable (D38)", async () => {
    fakeStore.holdItems = true;
    renderShopping();
    await page();
    expect(screen.getByRole("status", { name: "Lädt" })).toBeInTheDocument();
    expect(field()).toBeEnabled();
    expect(screen.queryByText("Oft gekauft")).not.toBeInTheDocument();
    act(() => fakeStore.emitItems());
    expect(openNames()).toHaveLength(4);
  });

  it("shows the error with «Nochmals versuchen» (D39)", async () => {
    fakeStore.itemsError = new Error("boom");
    renderShopping();
    await page();
    expect(screen.getByText("Einkauf konnte nicht geladen werden.")).toBeInTheDocument();
    fakeStore.itemsError = null;
    await userEvent.click(screen.getByRole("button", { name: "Nochmals versuchen" }));
    expect(openNames()).toHaveLength(4);
  });

  it("notes pending writes while offline (D44)", async () => {
    fakeStore.items = [
      makeItem({ id: "butter", name: "Butter", hasPendingWrites: true }),
      makeItem({
        id: "edited",
        name: "Käse",
        hasPendingWrites: true,
        updatedAt: new Date("2026-10-01T10:00:00Z"),
      }),
    ];
    renderShopping();
    await page();
    expect(
      await screen.findByText("Warte auf Sync · neu", undefined, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Warte auf Sync")).toBeInTheDocument();
  });
});

describe("adding (SHP-02, SHP-08, SHP-09)", () => {
  it("adds several items in a row and keeps the field focused", async () => {
    renderShopping();
    await page();
    await userEvent.click(field());
    await userEvent.type(field(), "Butter{Enter}");
    await userEvent.type(field(), "Zwiebeln{Enter}");
    await userEvent.type(field(), "WC-Papier{Enter}");
    expect(shoppingServiceMock.addItem).toHaveBeenCalledTimes(3);
    expect(document.activeElement).toBe(field());
    expect(field()).toHaveValue("");
    expect(shoppingServiceMock.addItem.mock.calls.map((call) => call[1])).toEqual([
      { name: "Butter", category: "groceries" },
      { name: "Zwiebeln", category: "groceries" },
      // Bought before as «Haushalt» (B5).
      { name: "WC-Papier", category: "household" },
    ]);
    expect(shoppingServiceMock.addItem.mock.calls[0][2]).toBe("nevio");
    expect(openNames()).toContain("Zwiebeln");
  });

  it("«Hinzufügen» adds without moving the focus", async () => {
    renderShopping();
    await page();
    await userEvent.type(field(), "  Hafer  milch ");
    await userEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));
    expect(shoppingServiceMock.addItem.mock.calls[0][1]).toEqual({
      name: "Hafer milch",
      category: "groceries",
    });
    expect(document.activeElement).toBe(field());
    expect(screen.queryByRole("button", { name: "Hinzufügen" })).not.toBeInTheDocument();
  });

  it("refuses an open duplicate with a hint (D36)", async () => {
    renderShopping();
    await page();
    await userEvent.type(field(), " milch {Enter}");
    expect(shoppingServiceMock.addItem).not.toHaveBeenCalled();
    expect(screen.getByText("Milch steht schon auf der Liste.")).toBeInTheDocument();
    expect(field()).toHaveValue(" milch ");
    await userEvent.type(field(), "x");
    expect(screen.queryByText("Milch steht schon auf der Liste.")).not.toBeInTheDocument();
  });

  it("re-adds a bought item instead of creating a second one (B4)", async () => {
    renderShopping();
    await page();
    await userEvent.type(field(), "brot{Enter}");
    expect(shoppingServiceMock.addItem).not.toHaveBeenCalled();
    expect(shoppingServiceMock.readdItem).toHaveBeenCalledTimes(1);
    expect(shoppingServiceMock.readdItem.mock.calls[0][1]).toMatchObject({ id: "bread" });
    expect(openNames()).toContain("Brot");
  });

  it("ignores an empty field", async () => {
    renderShopping();
    await page();
    await userEvent.type(field(), "   {Enter}");
    expect(shoppingServiceMock.addItem).not.toHaveBeenCalled();
  });
});

describe("suggestions (SHP-07, B9, B12)", () => {
  const options = () => screen.getAllByRole("option").map((option) => option.textContent);

  it("suggests bought names not on the list, prefix first, with an add row", async () => {
    renderShopping();
    await page();
    await userEvent.type(field(), "ha");
    expect(field()).toHaveAttribute("aria-expanded", "true");
    expect(options()).toEqual(["«ha» hinzufügen", "Hafermilch9× gekauft"]);
    await userEvent.clear(field());
    // «Milch» is open, so only «Hafermilch» matches «milch».
    await userEvent.type(field(), "milch");
    expect(options()).toEqual(["«milch» hinzufügen", "Hafermilch9× gekauft"]);
  });

  it("drops the add row when a suggestion matches exactly", async () => {
    renderShopping();
    await page();
    await userEvent.type(field(), "tomaten");
    expect(options()).toEqual(["Tomaten8× gekauft"]);
  });

  it("picks a suggestion with ↓ and Enter, keeping its category", async () => {
    renderShopping();
    await page();
    await userEvent.type(field(), "wc");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(field().getAttribute("aria-activedescendant")).toBe(screen.getAllByRole("option")[1].id);
    await userEvent.keyboard("{Enter}");
    expect(shoppingServiceMock.addItem.mock.calls[0][1]).toEqual({
      name: "WC-Papier",
      category: "household",
    });
    expect(field()).toHaveValue("");
    expect(document.activeElement).toBe(field());
  });

  it("picks a suggestion with a tap and closes with Esc", async () => {
    renderShopping();
    await page();
    await userEvent.type(field(), "oliv");
    await userEvent.click(screen.getByRole("option", { name: /Olivenöl/ }));
    expect(shoppingServiceMock.addItem.mock.calls[0][1]).toMatchObject({ name: "Olivenöl" });
    expect(document.activeElement).toBe(field());
    await userEvent.type(field(), "but");
    await userEvent.keyboard("{Escape}");
    expect(field()).toHaveValue("");
    expect(field()).toHaveAttribute("aria-expanded", "false");
  });
});

describe("«Oft gekauft» (SHP-07)", () => {
  it("offers the top five not on the list and adds with one tap", async () => {
    renderShopping();
    await page();
    const chips = within(screen.getByRole("region", { name: "Oft gekauft" }))
      .getAllByRole("button")
      .map((chip) => chip.textContent);
    // Milch is open; Brot and Eier are bought, so they're offered again.
    expect(chips).toEqual(["Brot", "Eier", "Hafermilch", "Tomaten", "WC-Papier"]);
    await userEvent.click(screen.getByRole("button", { name: "Hafermilch hinzufügen" }));
    expect(shoppingServiceMock.addItem.mock.calls[0][1]).toEqual({
      name: "Hafermilch",
      category: "groceries",
    });
    expect(screen.queryByRole("button", { name: "Hafermilch hinzufügen" })).not.toBeInTheDocument();
  });

  it("re-adds a bought chip (Brot) instead of a second item", async () => {
    renderShopping();
    await page();
    await userEvent.click(screen.getByRole("button", { name: "Brot hinzufügen" }));
    expect(shoppingServiceMock.readdItem).toHaveBeenCalledTimes(1);
  });

  it("is hidden without a purchase history", async () => {
    fakeStore.itemStats = [];
    renderShopping();
    await page();
    expect(screen.queryByText("Oft gekauft")).not.toBeInTheDocument();
  });
});

describe("check-off (SHP-04, B6)", () => {
  it("ticks at once, writes after 700 ms and offers «Rückgängig»", async () => {
    renderShopping();
    await page();
    const box = screen.getByRole("checkbox", { name: "Milch als gekauft markieren" });
    await userEvent.click(box);
    expect(box).toHaveAttribute("aria-checked", "true");
    expect(shoppingServiceMock.checkItem).not.toHaveBeenCalled();
    await waitFor(() => expect(shoppingServiceMock.checkItem).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    });
    expect(shoppingServiceMock.checkItem.mock.calls[0][1]).toMatchObject({ id: "milk" });
    expect(openNames()).not.toContain("Milch");
    expect(screen.getByText("«Milch» gekauft")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gekauft (3)" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Rückgängig" }));
    expect(shoppingServiceMock.uncheckItem).toHaveBeenCalledTimes(1);
    const [, item, knownStat] = shoppingServiceMock.uncheckItem.mock.calls[0];
    expect(item).toMatchObject({ id: "milk" });
    expect(knownStat).toMatchObject({ key: "milch", count: 12 });
    expect(openNames()).toContain("Milch");
  });

  it("a second tap within 700 ms cancels without writing", async () => {
    renderShopping();
    await page();
    const box = screen.getByRole("checkbox", { name: "Milch als gekauft markieren" });
    await userEvent.click(box);
    await userEvent.click(box);
    expect(box).toHaveAttribute("aria-checked", "false");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(shoppingServiceMock.checkItem).not.toHaveBeenCalled();
  });

  it("reports a rejected check of an item that is still open", async () => {
    shoppingServiceMock.checkItem.mockRejectedValue(
      Object.assign(new Error("denied"), { code: "permission-denied" }),
    );
    renderShopping();
    await page();
    await userEvent.click(screen.getByRole("checkbox", { name: "Milch als gekauft markieren" }));
    expect(
      await screen.findByText("Das hat nicht geklappt. Versuch es nochmals.", undefined, {
        timeout: 3000,
      }),
    ).toBeInTheDocument();
  });
});

describe("«Gekauft» (SHP-04, SHP-06)", () => {
  it("is collapsed, lists the latest purchase first with «von Anna», and unchecks", async () => {
    renderShopping();
    await page();
    const toggle = screen.getByRole("button", { name: "Gekauft (2)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("checkbox", { name: "Eier zurück auf die Liste" }),
    ).not.toBeInTheDocument();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const rows = within(screen.getByRole("list", { name: "Gekauft (2)" })).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual(["Eiervon Anna", "Brotvon Anna"]);
    await userEvent.click(screen.getByRole("checkbox", { name: "Eier zurück auf die Liste" }));
    expect(shoppingServiceMock.uncheckItem.mock.calls[0][1]).toMatchObject({ id: "eggs" });
    expect(shoppingServiceMock.uncheckItem.mock.calls[0][2]).toMatchObject({ key: "eier" });
    expect(openNames()).toContain("Eier");
  });

  it("«Gekaufte entfernen» removes them with «Rückgängig» (D41)", async () => {
    renderShopping();
    await page();
    await userEvent.click(screen.getByRole("button", { name: "Gekaufte entfernen" }));
    expect(shoppingServiceMock.clearCompleted).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /^Gekauft \(/ })).not.toBeInTheDocument();
    expect(screen.getByText("2 Artikel entfernt")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Rückgängig" }));
    expect(shoppingServiceMock.restoreItems).toHaveBeenCalledTimes(1);
    expect(shoppingServiceMock.restoreItems.mock.calls[0][1].map((i) => i.id).sort()).toEqual([
      "bread",
      "eggs",
    ]);
    expect(screen.getByRole("button", { name: "Gekauft (2)" })).toBeInTheDocument();
  });

  it("leaves out «von …» for someone who isn't a member any more", async () => {
    fakeStore.items = [makeItem({ id: "x", name: "Senf", checked: true, checkedBy: "lea" })];
    renderShopping();
    await page();
    await userEvent.click(screen.getByRole("button", { name: "Gekauft (1)" }));
    expect(
      screen.getByRole("checkbox", { name: "Senf zurück auf die Liste" }).closest("li"),
    ).toHaveTextContent(/^Senf$/);
  });
});

describe("desktop", () => {
  it("shows the summary, the ↵ field and the sidebar count", async () => {
    mockDesktop(true);
    renderShopping();
    await page();
    expect(screen.getByText("4 offen · 2 im Wagen · mit Anna geteilt")).toBeInTheDocument();
    expect(field()).toHaveAttribute("placeholder", "Artikel hinzufügen und Enter drücken");
    expect(screen.queryByRole("button", { name: "Hinzufügen" })).not.toBeInTheDocument();
    const sidebar = screen.getByRole("complementary", { name: "Seitenleiste" });
    expect(within(sidebar).getByRole("link", { name: /Einkauf/ })).toHaveTextContent("Einkauf 4");
    expect(screen.getByRole("heading", { name: "Oft gekauft" })).toBeInTheDocument();
  });
});

describe("Artikel-Sheet (5.8, D34, D37, D40)", () => {
  const sheet = () => screen.getByRole("dialog", { name: "Artikel bearbeiten" });
  async function openItem(name: string) {
    // The row's button is named by the item and its note, not «… hinzufügen» (a chip).
    await userEvent.click(
      screen.getByRole("button", { name: new RegExp(`^${name}(?! hinzufügen)`) }),
    );
    return sheet();
  }

  it("opens from the row with the item's values; «Speichern» waits for a change", async () => {
    renderShopping();
    await page();
    const dialog = await openItem("Milch");
    expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveValue("Milch");
    expect(within(dialog).getByRole("status")).toHaveTextContent("2");
    expect(within(dialog).getByRole("radio", { name: "l" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(within(dialog).getByRole("radio", { name: "Lebensmittel" })).toBeChecked();
    expect(within(dialog).getByRole("button", { name: "Speichern" })).toBeDisabled();
    // Opening doesn't tick the item off.
    expect(shoppingServiceMock.checkItem).not.toHaveBeenCalled();
  });

  it("saves the stepper quantity and a new category", async () => {
    renderShopping();
    await page();
    const dialog = await openItem("Milch");
    await userEvent.click(within(dialog).getByRole("button", { name: "Mehr" }));
    await userEvent.click(within(dialog).getByRole("radio", { name: "Haushalt" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Speichern" }));
    expect(shoppingServiceMock.updateItem).toHaveBeenCalledWith("h1", "milk", {
      quantity: "3 l",
      category: "household",
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Artikel bearbeiten" })).not.toBeInTheDocument(),
    );
    expect(groupHeadings()).toEqual(["Lebensmittel1", "Haushalt2", "Sonstiges1"]);
  });

  it("clears the quantity back to «–» (D37) and edits notes", async () => {
    renderShopping();
    await page();
    const dialog = await openItem("Milch");
    const less = within(dialog).getByRole("button", { name: "Weniger" });
    await userEvent.click(less);
    await userEvent.click(less);
    expect(within(dialog).getByRole("status")).toHaveTextContent("–");
    expect(less).toBeDisabled();
    expect(within(dialog).getByRole("radio", { name: "l" })).toBeDisabled();
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Notizen" }), "Laktosefrei");
    await userEvent.click(within(dialog).getByRole("button", { name: "Speichern" }));
    expect(shoppingServiceMock.updateItem).toHaveBeenCalledWith("h1", "milk", {
      quantity: null,
      notes: "Laktosefrei",
    });
  });

  it("starts empty for a quantity the stepper doesn't know, and keeps it (B2)", async () => {
    fakeStore.items = [makeItem({ id: "flour", name: "Mehl", quantity: "500 g" })];
    renderShopping();
    await page();
    const dialog = await openItem("Mehl");
    expect(within(dialog).getByRole("status")).toHaveTextContent("–");
    expect(within(dialog).getByText("Bisher: 500 g")).toBeInTheDocument();
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Notizen" }), "Weissmehl");
    await userEvent.click(within(dialog).getByRole("button", { name: "Speichern" }));
    expect(shoppingServiceMock.updateItem).toHaveBeenCalledWith("h1", "flour", {
      notes: "Weissmehl",
    });
  });

  it("refuses a rename to another open item (B4)", async () => {
    renderShopping();
    await page();
    const dialog = await openItem("Milch");
    const name = within(dialog).getByRole("textbox", { name: "Name" });
    await userEvent.clear(name);
    await userEvent.type(name, "kaffeebohnen");
    await userEvent.click(within(dialog).getByRole("button", { name: "Speichern" }));
    expect(within(dialog).getByText("Steht schon auf der Liste.")).toBeInTheDocument();
    expect(shoppingServiceMock.updateItem).not.toHaveBeenCalled();
    await userEvent.clear(name);
    expect(within(dialog).getByRole("button", { name: "Speichern" })).toBeDisabled();
  });

  it("deletes without a confirmation; «Rückgängig» brings it back as one's own", async () => {
    renderShopping();
    await page();
    const dialog = await openItem("Kaffeebohnen");
    await userEvent.click(within(dialog).getByRole("button", { name: "Artikel löschen" }));
    expect(shoppingServiceMock.deleteItem).toHaveBeenCalledWith("h1", "coffee");
    expect(openNames()).not.toContain("Kaffeebohnen");
    expect(screen.getByText("«Kaffeebohnen» gelöscht")).toBeInTheDocument();
    // No «deleted elsewhere» toast for our own delete.
    expect(screen.queryByText("Dieser Artikel wurde gelöscht.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Rückgängig" }));
    const [, restored] = shoppingServiceMock.restoreItems.mock.calls[0];
    expect(restored).toEqual([
      expect.objectContaining({ id: "coffee", checked: false, createdBy: "nevio" }),
    ]);
    expect(openNames()).toContain("Kaffeebohnen");
  });

  it("closes with a toast when someone else deletes the item (D40)", async () => {
    renderShopping();
    await page();
    await openItem("Milch");
    act(() => fakeStore.setItems(fakeStore.items.filter((i) => i.id !== "milk")));
    expect(await screen.findByText("Dieser Artikel wurde gelöscht.")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Artikel bearbeiten" })).not.toBeInTheDocument(),
    );
  });

  it("opens from a «Gekauft» row too", async () => {
    renderShopping();
    await page();
    await userEvent.click(screen.getByRole("button", { name: "Gekauft (2)" }));
    const dialog = await openItem("Eier");
    expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveValue("Eier");
    expect(shoppingServiceMock.uncheckItem).not.toHaveBeenCalled();
  });

  it("desktop: a dialog with «Abbrechen» and «Artikel löschen» in the footer (D35)", async () => {
    mockDesktop(true);
    renderShopping();
    await page();
    const dialog = await openItem("Milch");
    expect(within(dialog).getByRole("button", { name: "Abbrechen" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Artikel löschen" })).toHaveTextContent(
      "Artikel löschen",
    );
  });
});

describe("Schnellerfassung «Einkauf» (5.9, D43)", () => {
  async function openQuickAdd() {
    await userEvent.click(screen.getByRole("button", { name: "Schnellerfassung" }));
    const sheet = screen.getByRole("dialog", { name: "Schnellerfassung" });
    await userEvent.click(within(sheet).getByRole("radio", { name: "Einkauf" }));
    return sheet;
  }

  it("adds in a row with a status line, keeping the focus", async () => {
    renderShopping();
    await page();
    const sheet = await openQuickAdd();
    const input = within(sheet).getByRole("textbox", { name: "Was braucht ihr?" });
    await userEvent.type(input, "Butter{Enter}");
    expect(within(sheet).getByText("«Butter» zum Einkauf hinzugefügt")).toBeInTheDocument();
    expect(input).toHaveValue("");
    expect(document.activeElement).toBe(input);
    await userEvent.type(input, "Senf");
    await userEvent.click(within(sheet).getByRole("button", { name: "Auf die Liste" }));
    expect(shoppingServiceMock.addItem.mock.calls.map((call) => call[1].name)).toEqual([
      "Butter",
      "Senf",
    ]);
  });

  it("offers four frequent items that add at once", async () => {
    renderShopping();
    await page();
    const sheet = await openQuickAdd();
    for (const name of ["Brot", "Eier", "Hafermilch", "Tomaten"]) {
      expect(within(sheet).getByRole("button", { name: `${name} hinzufügen` })).toBeInTheDocument();
    }
    expect(
      within(sheet).queryByRole("button", { name: "WC-Papier hinzufügen" }),
    ).not.toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole("button", { name: "Hafermilch hinzufügen" }));
    expect(shoppingServiceMock.addItem.mock.calls[0][1]).toEqual({
      name: "Hafermilch",
      category: "groceries",
    });
    expect(within(sheet).getByText("«Hafermilch» zum Einkauf hinzugefügt")).toBeInTheDocument();
  });

  it("shows the duplicate hint (D36)", async () => {
    renderShopping();
    await page();
    const sheet = await openQuickAdd();
    await userEvent.type(
      within(sheet).getByRole("textbox", { name: "Was braucht ihr?" }),
      "MILCH{Enter}",
    );
    expect(shoppingServiceMock.addItem).not.toHaveBeenCalled();
    expect(within(sheet).getByText("Milch steht schon auf der Liste.")).toBeInTheDocument();
  });
});
