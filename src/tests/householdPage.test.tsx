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
    expect(await screen.findByRole("heading", { name: "Aufgaben", level: 1 })).toBeInTheDocument();
  });

  it("goes back to Start when opened directly (B12)", async () => {
    renderHousehold();
    await page();
    await userEvent.click(
      within(screen.getAllByRole("banner")[0]).getByRole("button", { name: "Zurück" }),
    );
    await waitFor(() => expect(currentPath()).toBe("/dashboard"));
  });

  it("has no Gefahrenzone and no member menu (B2, B3)", async () => {
    renderHousehold();
    await page();
    expect(screen.queryByText("Gefahrenzone")).not.toBeInTheDocument();
    expect(screen.queryByText("Haushalt verlassen")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Optionen für/ })).not.toBeInTheDocument();
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
