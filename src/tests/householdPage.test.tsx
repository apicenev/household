import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/ToastProvider";
import { AuthContext, type AuthContextValue } from "../lib/auth/useAuth";
import { AppRoutes } from "../router/AppRoutes";
import {
  fakeStore,
  householdServiceMock,
  makeHousehold,
  makeMember,
  memberServiceMock,
  nevioProfile,
} from "./householdFakes";

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
const invites = vi.hoisted(() => ({ regenerateInvite: vi.fn() }));
vi.mock("../services/inviteService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/inviteService")>()),
  regenerateInvite: invites.regenerateInvite,
}));

const DAY_MS = 24 * 60 * 60 * 1000;
const annaProfile = {
  ...nevioProfile,
  uid: "anna",
  displayName: "Anna",
  email: "anna@example.ch",
  initials: "AN",
  avatarColor: 1 as const,
};

function renderHousehold({
  as = nevioProfile,
  entries = ["/household"],
}: { as?: typeof nevioProfile; entries?: string[] } = {}) {
  const auth: AuthContextValue = {
    user: { uid: as.uid, email: as.email },
    profile: as,
    confirmedHouseholdId: "h1",
    initializing: false,
    login: vi.fn(),
    logout: vi.fn(),
  };
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={entries}>
        <ToastProvider>
          <AppRoutes />
          <LocationProbe />
        </ToastProvider>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

const currentPath = () => screen.getByTestId("location").textContent;
// The lazy page can take more than findBy's default 1 s to load under full-suite load.
const page = () =>
  screen.findByRole("heading", { name: "Musterstrasse 12", level: 1 }, { timeout: 3000 });
const section = (name: string) => screen.getByRole("region", { name });

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

beforeAll(async () => {
  await import("../pages/HouseholdPage");
});

beforeEach(() => {
  fakeStore.reset();
  householdServiceMock.updateHouseholdSettings.mockReset().mockResolvedValue(undefined);
  memberServiceMock.updateMyProfile.mockReset().mockResolvedValue(undefined);
  invites.regenerateInvite.mockReset().mockResolvedValue("NEW-1234");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.title = "";
});

describe("Haushalt page", () => {
  it("lists the members owner first, with «Du», role and join date", async () => {
    renderHousehold();
    await page();
    const rows = within(section("Mitglieder 2")).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "NENevioDuBesitzer · Dabei seit 14.09.2026Besitzer",
      "ANAnnaMitglied · Dabei seit 20.09.2026Mitglied",
    ]);
    // The title is set in an effect, which can run after the heading shows up.
    await waitFor(() => expect(document.title).toBe("Haushalt – Household"));
  });

  it("updates the member list live", async () => {
    renderHousehold();
    await page();
    fakeStore.members = [
      ...fakeStore.members,
      makeMember({ uid: "lea", displayName: "Lea", joinedAt: new Date("2026-10-02T10:00:00Z") }),
    ];
    act(() => fakeStore.emit());
    expect(within(section("Mitglieder 3")).getByText("Lea")).toBeInTheDocument();
  });

  it("has a back button and no tab bar on phones (B12)", async () => {
    renderHousehold({ entries: ["/tasks", "/household"] });
    await page();
    const header = screen.getAllByRole("banner")[0];
    expect(within(header).getByText("Haushalt")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Schnellerfassung" })).not.toBeInTheDocument();
    await userEvent.click(within(header).getByRole("button", { name: "Zurück" }));
    // Aufgaben is lazy-loaded; same timeout as the other page helpers.
    expect(
      await screen.findByRole("heading", { name: "Aufgaben", level: 1 }, { timeout: 3000 }),
    ).toBeInTheDocument();
  });

  it("goes back to Start when opened directly (B12)", async () => {
    renderHousehold();
    await page();
    await userEvent.click(
      within(screen.getAllByRole("banner")[0]).getByRole("button", { name: "Zurück" }),
    );
    await waitFor(() => expect(currentPath()).toBe("/dashboard"));
  });
});

describe("Gefahrenzone and member menu (Phase 9)", () => {
  beforeEach(() => {
    for (const fn of [
      householdServiceMock.leaveHousehold,
      householdServiceMock.removeMember,
      householdServiceMock.handOverHousehold,
      householdServiceMock.deleteHousehold,
    ]) {
      fn.mockReset().mockResolvedValue(undefined);
    }
  });

  const zone = () => screen.getByRole("region", { name: "Gefahrenzone" });
  const openMenu = async (name: string) => userEvent.click(screen.getByRole("button", { name }));

  it("gives a member «Profil bearbeiten» and «Haushalt verlassen», nothing on others' rows (D83)", async () => {
    renderHousehold({ as: annaProfile });
    await page();
    expect(screen.queryByRole("button", { name: "Optionen für Nevio" })).not.toBeInTheDocument();
    await openMenu("Optionen für dich");
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(items).toEqual(["Profil bearbeiten", "Haushalt verlassen"]);
    expect(within(zone()).getByRole("button", { name: "Haushalt verlassen" })).toBeEnabled();
    expect(within(zone()).queryByRole("button", { name: "Haushalt löschen" })).toBeNull();
  });

  it("disables leaving for the owner with the designed hint (D84) and offers the owner actions", async () => {
    renderHousehold();
    await page();
    expect(within(zone()).getByRole("button", { name: "Haushalt verlassen" })).toBeDisabled();
    expect(
      within(zone()).getByText(
        "Als Besitzer machst du zuerst jemand anderen zum Besitzer, bevor du den Haushalt verlässt.",
      ),
    ).toBeInTheDocument();
    expect(within(zone()).getByRole("button", { name: "Haushalt löschen" })).toBeEnabled();
    await openMenu("Optionen für Anna");
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Haushalt übergeben",
      "Aus dem Haushalt entfernen",
    ]);
  });

  it("leaves after the confirmation and says so (D84, D87)", async () => {
    renderHousehold({ as: annaProfile });
    await page();
    await userEvent.click(within(zone()).getByRole("button", { name: "Haushalt verlassen" }));
    const dialog = screen.getByRole("alertdialog", { name: "Haushalt verlassen?" });
    expect(
      within(dialog).getByText("Deine offenen Aufgaben werden niemandem mehr zugewiesen."),
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Verlassen" }));
    expect(householdServiceMock.leaveHousehold).toHaveBeenCalledWith(
      expect.objectContaining({ id: "h1" }),
      expect.objectContaining({ uid: "anna" }),
      [],
    );
    expect(await screen.findByText("Du hast «Musterstrasse 12» verlassen.")).toBeInTheDocument();
  });

  it("shows the write error when leaving fails and keeps the dialog", async () => {
    householdServiceMock.leaveHousehold.mockRejectedValue(
      Object.assign(new Error("denied"), { code: "permission-denied" }),
    );
    renderHousehold({ as: annaProfile });
    await page();
    await userEvent.click(within(zone()).getByRole("button", { name: "Haushalt verlassen" }));
    await userEvent.click(screen.getByRole("button", { name: "Verlassen" }));
    expect(await screen.findByText("Dazu hast du keine Berechtigung.")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog", { name: "Haushalt verlassen?" })).toBeInTheDocument();
  });

  it("deletes only after the household name is typed", async () => {
    renderHousehold();
    await page();
    await userEvent.click(within(zone()).getByRole("button", { name: "Haushalt löschen" }));
    const dialog = screen.getByRole("alertdialog", { name: "Haushalt löschen?" });
    expect(
      within(dialog).getByText(
        "Alle Aufgaben, Listen und Termine von Nevio und Anna werden endgültig gelöscht. Das lässt sich nicht rückgängig machen.",
      ),
    ).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: /endgültig löschen/i });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByRole("textbox"), "Musterstrasse 12");
    await userEvent.click(confirm);
    expect(householdServiceMock.deleteHousehold).toHaveBeenCalledWith(
      expect.objectContaining({ id: "h1" }),
      "nevio",
    );
    expect(await screen.findByText("«Musterstrasse 12» wurde gelöscht.")).toBeInTheDocument();
  });

  it("hands over with a gender-neutral confirmation (D85)", async () => {
    renderHousehold();
    await page();
    await openMenu("Optionen für Anna");
    await userEvent.click(screen.getByRole("menuitem", { name: "Haushalt übergeben" }));
    const dialog = screen.getByRole("alertdialog", { name: "Haushalt an Anna übergeben?" });
    expect(
      within(dialog).getByText(
        "Danach kann nur noch Anna Einstellungen ändern, Mitglieder entfernen und den Haushalt löschen.",
      ),
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Übergeben" }));
    expect(householdServiceMock.handOverHousehold).toHaveBeenCalledWith(
      expect.objectContaining({ id: "h1" }),
      "nevio",
      expect.objectContaining({ uid: "anna" }),
    );
    expect(await screen.findByText("Anna verwaltet jetzt «Musterstrasse 12».")).toBeInTheDocument();
  });

  it("removes a member after the confirmation (D86)", async () => {
    renderHousehold();
    await page();
    await openMenu("Optionen für Anna");
    await userEvent.click(screen.getByRole("menuitem", { name: "Aus dem Haushalt entfernen" }));
    const dialog = screen.getByRole("alertdialog", { name: "Anna entfernen?" });
    expect(
      within(dialog).getByText(
        "Anna verliert den Zugriff auf «Musterstrasse 12». Offene Aufgaben von Anna werden niemandem mehr zugewiesen.",
      ),
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Entfernen" }));
    expect(householdServiceMock.removeMember).toHaveBeenCalledWith(
      expect.objectContaining({ id: "h1" }),
      "nevio",
      expect.objectContaining({ uid: "anna" }),
      [],
    );
    expect(await screen.findByText("Anna wurde entfernt.")).toBeInTheDocument();
  });

  it("tells a sole member to delete instead (D84)", async () => {
    fakeStore.household = makeHousehold({ memberIds: ["nevio"] });
    fakeStore.members = fakeStore.members.filter((member) => member.uid === "nevio");
    renderHousehold();
    await page();
    expect(within(zone()).getByRole("button", { name: "Haushalt verlassen" })).toBeDisabled();
    expect(
      within(zone()).getByText(
        "Du bist allein im Haushalt. Lösche ihn, wenn du ihn nicht mehr brauchst.",
      ),
    ).toBeInTheDocument();
  });

  it("blocks the lifecycle actions in the demo household (D96)", async () => {
    fakeStore.household = makeHousehold({ demo: true });
    renderHousehold();
    await page();
    expect(within(zone()).getByRole("button", { name: "Haushalt verlassen" })).toBeDisabled();
    expect(within(zone()).getByRole("button", { name: "Haushalt löschen" })).toBeDisabled();
    expect(within(zone()).getByText("In der Demo nicht verfügbar.")).toBeInTheDocument();
    await openMenu("Optionen für Anna");
    for (const item of screen.getAllByRole("menuitem")) {
      expect(item).toHaveAttribute("aria-disabled", "true");
    }
  });

  it("locks the household name and the own name in the demo, not the colour (C5, D96)", async () => {
    fakeStore.household = makeHousehold({ demo: true });
    renderHousehold();
    await page();
    const settingsName = within(section("Einstellungen")).getByRole("textbox", { name: "Name" });
    const profileName = within(section("Mein Profil")).getByRole("textbox", { name: "Name" });
    expect(settingsName).toBeDisabled();
    expect(profileName).toBeDisabled();
    expect(profileName).toHaveAccessibleDescription("In der Demo nicht verfügbar.");
    expect(within(section("Mein Profil")).getAllByRole("radio")[0]).toBeEnabled();
  });

  it("offers to resume an interrupted delete (D89)", async () => {
    fakeStore.household = makeHousehold({ deleting: true });
    renderHousehold();
    await page();
    expect(within(zone()).getByText("Das Löschen wurde unterbrochen.")).toBeInTheDocument();
    await userEvent.click(within(zone()).getByRole("button", { name: "Löschen fortsetzen" }));
    expect(householdServiceMock.deleteHousehold).toHaveBeenCalledWith(
      expect.objectContaining({ id: "h1" }),
      "nevio",
    );
  });

  it("disables the actions offline (D91)", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderHousehold({ as: annaProfile });
    await page();
    expect(within(zone()).getByRole("button", { name: "Haushalt verlassen" })).toBeDisabled();
  });

  it("shows the outlined section with buttons on desktop", async () => {
    mockDesktop(true);
    renderHousehold();
    await page();
    expect(within(zone()).getByRole("heading", { name: "Gefahrenzone" })).toBeInTheDocument();
    expect(within(zone()).getByRole("button", { name: "Haushalt löschen" })).toBeEnabled();
  });
});

describe("Einladen", () => {
  it("shows the code with its expiry and copies it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText }, onLine: true });
    renderHousehold();
    await page();
    const card = section("Einladen");
    expect(within(card).getByText("Mit Code beitreten")).toBeInTheDocument();
    expect(within(card).getByText("MST-4821")).toBeInTheDocument();
    expect(within(card).getByText(/^bis \w{2}\., \d{1,2}\. \w+\.?$/)).toBeInTheDocument();
    expect(within(card).queryByText(/Link/)).not.toBeInTheDocument();

    await userEvent.click(within(card).getByRole("button", { name: "Code kopieren" }));
    expect(writeText).toHaveBeenCalledWith("MST-4821");
    expect(within(card).getByRole("button", { name: "Kopiert" })).toBeInTheDocument();
    expect(within(card).getAllByText("Kopiert").length).toBe(2); // button + live region
    await waitFor(
      () => expect(within(card).getByRole("button", { name: "Code kopieren" })).toBeInTheDocument(),
      { timeout: 2500 },
    );
  });

  it("lets the owner create a new code", async () => {
    renderHousehold();
    await page();
    await userEvent.click(within(section("Einladen")).getByRole("button", { name: "Neuer Code" }));
    expect(invites.regenerateInvite).toHaveBeenCalledWith(
      expect.objectContaining({ id: "h1", inviteCode: "MST-4821" }),
      nevioProfile,
    );
  });

  it("shows an error toast when the new code fails", async () => {
    invites.regenerateInvite.mockRejectedValue(
      Object.assign(new Error("offline"), { code: "unavailable" }),
    );
    renderHousehold();
    await page();
    await userEvent.click(within(section("Einladen")).getByRole("button", { name: "Neuer Code" }));
    expect(
      await screen.findByText("Keine Verbindung. Prüf dein Internet und versuch es nochmals."),
    ).toBeInTheDocument();
  });

  it("doesn't offer «Neuer Code» to members (B4)", async () => {
    renderHousehold({ as: annaProfile });
    await page();
    const card = section("Einladen");
    expect(within(card).queryByRole("button", { name: "Neuer Code" })).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Code kopieren" })).toBeEnabled();
  });

  it("shows an expired code (D4) to the owner", async () => {
    fakeStore.household = {
      ...fakeStore.household!,
      inviteCreatedAt: new Date(Date.now() - 8 * DAY_MS),
    };
    renderHousehold();
    await page();
    const card = section("Einladen");
    expect(within(card).getByText(/^Abgelaufen am /)).toHaveClass("text-danger");
    expect(within(card).getByRole("button", { name: "Code kopieren" })).toBeDisabled();
    expect(within(card).getByRole("button", { name: "Neuer Code" })).toBeEnabled();
    expect(screen.queryByText(/Bitte .* um einen neuen Code/)).not.toBeInTheDocument();
  });

  it("asks members to get a new code from the owner (D4)", async () => {
    fakeStore.household = {
      ...fakeStore.household!,
      inviteCreatedAt: new Date(Date.now() - 8 * DAY_MS),
    };
    renderHousehold({ as: annaProfile });
    await page();
    expect(screen.getByText("Bitte Nevio um einen neuen Code.")).toBeInTheDocument();
  });
});

describe("Einstellungen", () => {
  it("saves a new name on blur (B1)", async () => {
    renderHousehold();
    await page();
    const name = within(section("Einstellungen")).getByLabelText("Name");
    expect(name).toHaveValue("Musterstrasse 12");
    await userEvent.clear(name);
    await userEvent.type(name, "  WG Linde ");
    expect(householdServiceMock.updateHouseholdSettings).not.toHaveBeenCalled();
    await userEvent.tab();
    expect(householdServiceMock.updateHouseholdSettings).toHaveBeenCalledWith(
      expect.objectContaining({ id: "h1" }),
      { name: "WG Linde" },
    );
  });

  it("saves on Enter and doesn't save an unchanged name", async () => {
    renderHousehold();
    await page();
    const name = within(section("Einstellungen")).getByLabelText("Name");
    await userEvent.type(name, "{Enter}");
    expect(householdServiceMock.updateHouseholdSettings).not.toHaveBeenCalled();
    await userEvent.type(name, "!{Enter}");
    expect(householdServiceMock.updateHouseholdSettings).toHaveBeenCalledWith(expect.anything(), {
      name: "Musterstrasse 12!",
    });
  });

  it("shows a field error for an empty name and saves nothing", async () => {
    renderHousehold();
    await page();
    const name = within(section("Einstellungen")).getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.tab();
    expect(name).toHaveAccessibleDescription("Gib einen Namen ein.");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(householdServiceMock.updateHouseholdSettings).not.toHaveBeenCalled();
  });

  it("shows a failed write as the field error", async () => {
    householdServiceMock.updateHouseholdSettings.mockRejectedValue(
      Object.assign(new Error("offline"), { code: "unavailable" }),
    );
    renderHousehold();
    await page();
    const name = within(section("Einstellungen")).getByLabelText("Name");
    await userEvent.type(name, "!");
    await userEvent.tab();
    expect(name).toHaveAccessibleDescription(
      "Keine Verbindung. Prüf dein Internet und versuch es nochmals.",
    );
  });

  it("saves week start and time zone on change", async () => {
    renderHousehold();
    await page();
    const settings = section("Einstellungen");
    await userEvent.click(within(settings).getByRole("radio", { name: "Sonntag" }));
    expect(householdServiceMock.updateHouseholdSettings).toHaveBeenCalledWith(expect.anything(), {
      weekStartsOn: 0,
    });
    await userEvent.selectOptions(within(settings).getByLabelText("Zeitzone"), "Europe/Vienna");
    expect(householdServiceMock.updateHouseholdSettings).toHaveBeenCalledWith(expect.anything(), {
      timeZone: "Europe/Vienna",
    });
  });

  it("shows the time zone with its abbreviation on phones (B6)", async () => {
    renderHousehold();
    await page();
    const zone = within(section("Einstellungen")).getByLabelText("Zeitzone");
    expect(within(zone).getByRole("option", { selected: true }).textContent).toMatch(
      /^Europa\/Zürich \((MEZ|MESZ)\)$/,
    );
    expect(within(zone).getAllByRole("option")).toHaveLength(9);
  });

  it("disables the settings for members with a caption (D5)", async () => {
    renderHousehold({ as: annaProfile });
    await page();
    const settings = section("Einstellungen");
    expect(within(settings).getByLabelText("Name")).toBeDisabled();
    expect(within(settings).getByLabelText("Zeitzone")).toBeDisabled();
    expect(within(settings).getByRole("radio", { name: "Montag" })).toBeDisabled();
    expect(
      within(settings).getByText("Nur Nevio kann die Einstellungen ändern."),
    ).toBeInTheDocument();
    const order = within(settings).getByRole("list", { name: "Reihenfolge beim Abwechseln" });
    for (const button of within(order).getAllByRole("button")) expect(button).toBeDisabled();
  });

  it("the owner sets the default rotation order (HH-07, D30)", async () => {
    renderHousehold();
    await page();
    const settings = section("Einstellungen");
    const order = within(settings).getByRole("list", { name: "Reihenfolge beim Abwechseln" });
    // No order saved yet: members by join date, Nevio (owner) first.
    expect(
      within(order)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["NENevio", "ANAnna"]);
    expect(within(order).getByRole("button", { name: "Nevio nach oben" })).toBeDisabled();
    await userEvent.click(within(order).getByRole("button", { name: "Anna nach oben" }));
    expect(householdServiceMock.updateHouseholdSettings).toHaveBeenCalledWith(expect.anything(), {
      rotationOrder: ["anna", "nevio"],
    });
  });

  it("hides the rotation order with a single member (D30)", async () => {
    fakeStore.members = fakeStore.members.filter((member) => member.uid === "nevio");
    renderHousehold();
    await page();
    expect(
      within(section("Einstellungen")).queryByText("Reihenfolge beim Abwechseln"),
    ).not.toBeInTheDocument();
  });
});

describe("Mein Profil", () => {
  it("shows the email and saves a new name with live initials", async () => {
    renderHousehold();
    await page();
    const profile = section("Mein Profil");
    expect(profile).toHaveAttribute("id", "profil");
    expect(within(profile).getByText("nevio@example.ch")).toBeInTheDocument();
    const name = within(profile).getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Nevio Apicella");
    expect(within(profile).getByText("Nevio Apicella")).toBeInTheDocument();
    expect(within(profile).getAllByText("NA").length).toBeGreaterThan(0);
    await userEvent.tab();
    expect(memberServiceMock.updateMyProfile).toHaveBeenCalledWith(
      nevioProfile,
      expect.objectContaining({ id: "h1" }),
      { displayName: "Nevio Apicella" },
    );
  });

  it("changes the avatar colour with the arrow keys", async () => {
    renderHousehold();
    await page();
    const colors = within(section("Mein Profil")).getByRole("radiogroup", { name: "Avatarfarbe" });
    const swatches = within(colors).getAllByRole("radio");
    expect(swatches.map((swatch) => swatch.getAttribute("aria-label"))).toEqual([
      "Terrakotta",
      "Honig",
      "Olive",
      "Salbei",
      "Seegrün",
      "Taubenblau",
      "Lavendel",
      "Rosé",
    ]);
    const selected = within(colors).getByRole("radio", { name: "Taubenblau" });
    expect(selected).toHaveAttribute("aria-checked", "true");
    expect(selected).toHaveTextContent("NE");
    selected.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(memberServiceMock.updateMyProfile).toHaveBeenCalledWith(
      nevioProfile,
      expect.anything(),
      { avatarColor: 7 },
    );
    expect(within(colors).getByRole("radio", { name: "Lavendel" })).toHaveFocus();
  });

  it("scrolls to the profile for #profil", async () => {
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    renderHousehold({ entries: ["/household#profil"] });
    await page();
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    expect(scroll.mock.contexts[0]).toBe(section("Mein Profil"));
  });
});

describe("desktop", () => {
  it("shows the desktop texts and the title with members and creation date", async () => {
    mockDesktop(true);
    renderHousehold();
    await page();
    expect(screen.getByText("2 Mitglieder · erstellt am 14.09.2026")).toBeInTheDocument();
    const card = section("Zu Musterstrasse 12 einladen");
    expect(within(card).getByText("Alle mit dem Code können beitreten")).toBeInTheDocument();
    expect(within(card).getByText(/^Gültig bis /)).toBeInTheDocument();
    const zone = within(section("Einstellungen")).getByLabelText("Zeitzone");
    expect(within(zone).getByRole("option", { selected: true })).toHaveTextContent(
      /^Europa\/Zürich$/,
    );
    // Profile: avatar next to the name field, no email line.
    expect(within(section("Mein Profil")).queryByText("nevio@example.ch")).not.toBeInTheDocument();
  });
});
