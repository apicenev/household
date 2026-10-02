import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/ToastProvider";
import { AuthContext, type AuthContextValue } from "../lib/auth/useAuth";
import { AppRoutes } from "../router/AppRoutes";
import type { Invite } from "../types";
import { fakeStore, householdServiceMock, nevioProfile } from "./householdFakes";

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

const invites = vi.hoisted(() => ({
  getInvite: vi.fn<(code: string) => Promise<Invite | null>>(),
  joinHousehold: vi.fn<(invite: Invite, profile: unknown) => Promise<void>>(),
}));
vi.mock("../services/inviteService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/inviteService")>()),
  getInvite: invites.getInvite,
  joinHousehold: invites.joinHousehold,
}));

const { JoinError } = await import("../services/inviteService");

const profile = { ...nevioProfile, householdId: undefined };

function renderOnboarding(path = "/onboarding", initialEntries: string[] = [path]) {
  const logout = vi.fn();
  const control: { setAuth: (patch: Partial<AuthContextValue>) => void } = { setAuth: () => {} };

  function Harness() {
    const [auth, set] = useState<AuthContextValue>({
      user: { uid: "nevio", email: "nevio@example.ch" },
      profile,
      confirmedHouseholdId: null,
      initializing: false,
      login: vi.fn(),
      logout: async () => {
        logout();
        set((current) => ({ ...current, user: null, profile: null }));
      },
    });
    useEffect(() => {
      control.setAuth = (patch) => set((current) => ({ ...current, ...patch }));
    }, []);
    return (
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={initialEntries}>
          <ToastProvider>
            <AppRoutes />
            <LocationProbe />
          </ToastProvider>
        </MemoryRouter>
      </AuthContext.Provider>
    );
  }

  render(<Harness />);
  return {
    logout,
    setAuth: (patch: Partial<AuthContextValue>) => act(() => control.setAuth(patch)),
  };
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

const currentPath = () => screen.getByTestId("location").textContent;

function invite(overrides: Partial<Invite> = {}): Invite {
  return {
    code: "MST-4821",
    householdId: "h1",
    householdName: "Musterstrasse 12",
    ownerName: "Nevio",
    memberCount: 1,
    createdBy: "nevio",
    createdAt: new Date(),
    ...overrides,
  };
}

// Load the lazy pages once up front, so the first test doesn't wait on a cold import.
beforeAll(async () => {
  await Promise.all([
    import("../pages/LoginPage"),
    import("../pages/HouseholdPage"),
    import("../pages/onboarding/OnboardingChoicePage"),
    import("../pages/onboarding/CreateHouseholdPage"),
    import("../pages/onboarding/JoinHouseholdPage"),
  ]);
});

beforeEach(() => {
  fakeStore.reset();
  householdServiceMock.createHousehold.mockReset();
  invites.getInvite.mockReset().mockResolvedValue(null);
  invites.joinHousehold.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Auswahl", () => {
  it("greets by first name and asks how to start", async () => {
    renderOnboarding();
    expect(await screen.findByRole("heading", { name: "Hallo Nevio" })).toBeInTheDocument();
    expect(screen.getByText("Wie möchtest du starten?")).toBeInTheDocument();
    expect(screen.getByText("Jemand hat dir einen Code geschickt.")).toBeInTheDocument();
    expect(screen.queryByText(/Link/)).not.toBeInTheDocument();
  });

  it("selects a card with the arrow keys and continues to it", async () => {
    renderOnboarding();
    const group = await screen.findByRole("radiogroup", { name: "Wie möchtest du starten?" });
    const create = within(group).getByRole("radio", { name: /Haushalt erstellen/ });
    const join = within(group).getByRole("radio", { name: /Mit Code beitreten/ });
    expect(create).toHaveAttribute("aria-checked", "true");
    expect(join).toHaveAttribute("tabindex", "-1");

    create.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(join).toHaveAttribute("aria-checked", "true");
    expect(join).toHaveFocus();
    expect(create).toHaveAttribute("aria-checked", "false");

    await userEvent.click(screen.getByRole("button", { name: "Weiter" }));
    expect(await screen.findByRole("heading", { name: "Mit Code beitreten" })).toBeInTheDocument();
    expect(currentPath()).toBe("/onboarding/join");
  });

  it("continues to «Haushalt erstellen» by default", async () => {
    renderOnboarding();
    await userEvent.click(await screen.findByRole("button", { name: "Weiter" }));
    expect(await screen.findByRole("heading", { name: "Haushalt erstellen" })).toBeInTheDocument();
  });

  it("opens a menu with only «Abmelden» from the avatar (D6)", async () => {
    const { logout } = renderOnboarding();
    await userEvent.click(await screen.findByRole("button", { name: "Kontomenü" }));
    const items = screen.getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Abmelden"]);
    await userEvent.click(items[0]);
    expect(logout).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("heading", { name: "Willkommen zurück" })).toBeInTheDocument();
  });
});

describe("Haushalt erstellen", () => {
  const submitButton = () => screen.getByRole("button", { name: /Haushalt erstellen|Erstellt…/ });

  it("is disabled while the name is empty; a suggestion fills it", async () => {
    renderOnboarding("/onboarding/create");
    const field = await screen.findByLabelText("Name des Haushalts");
    expect(submitButton()).toBeDisabled();
    expect(screen.getByText("Zum Beispiel eure Adresse oder «WG Linde».")).toBeInTheDocument();

    const suggestions = screen.getByRole("group", { name: "Vorschläge" });
    expect(
      within(suggestions)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Zuhause", "WG Linde", "Unsere Wohnung"]);
    await userEvent.click(within(suggestions).getByRole("button", { name: "WG Linde" }));
    expect(field).toHaveValue("WG Linde");
    expect(submitButton()).toBeEnabled();

    await userEvent.clear(field);
    await userEvent.type(field, "   ");
    expect(submitButton()).toBeDisabled();
  });

  it("creates the household, stays loading and moves on once confirmed", async () => {
    let resolve = () => {};
    householdServiceMock.createHousehold.mockImplementation(
      () => new Promise<string>((done) => (resolve = () => done("h1"))),
    );
    const { setAuth } = renderOnboarding("/onboarding/create");
    await userEvent.type(await screen.findByLabelText("Name des Haushalts"), "  WG Linde {Enter}");

    expect(householdServiceMock.createHousehold).toHaveBeenCalledWith(profile, "WG Linde");
    expect(screen.getByRole("button", { name: "Erstellt…" })).toHaveAttribute("aria-busy", "true");

    // The batch commits: still on the page until the server-confirmed id arrives.
    await act(async () => resolve());
    expect(currentPath()).toBe("/onboarding/create");
    expect(screen.getByRole("button", { name: "Erstellt…" })).toBeInTheDocument();

    setAuth({ confirmedHouseholdId: "h1", profile: nevioProfile });
    expect(await screen.findByRole("heading", { name: "Start", level: 1 })).toBeInTheDocument();
    expect(currentPath()).toBe("/dashboard");
  });

  it("keeps the name and shows the error when the create is rejected", async () => {
    householdServiceMock.createHousehold.mockRejectedValue(
      Object.assign(new Error("denied"), { code: "permission-denied" }),
    );
    renderOnboarding("/onboarding/create");
    const field = await screen.findByLabelText("Name des Haushalts");
    await userEvent.type(field, "WG Linde{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Das hat nicht geklappt. Versuch es nochmals.",
    );
    expect(field).toHaveValue("WG Linde");
    expect(submitButton()).toHaveTextContent("Haushalt erstellen");
    expect(submitButton()).toBeEnabled();
  });

  it("goes back to the choice with the back chevron", async () => {
    renderOnboarding("/onboarding/create", ["/onboarding", "/onboarding/create"]);
    await userEvent.click(await screen.findByRole("button", { name: "Zurück" }));
    expect(currentPath()).toBe("/onboarding");
  });

  it("goes to the choice when opened directly", async () => {
    renderOnboarding("/onboarding/create");
    await userEvent.click(await screen.findByRole("button", { name: "Zurück" }));
    expect(currentPath()).toBe("/onboarding");
  });

  it("shows the offline banner and disables the button while offline (D11)", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderOnboarding("/onboarding/create");
    await userEvent.type(await screen.findByLabelText("Name des Haushalts"), "WG Linde{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent("Keine Verbindung");
    expect(submitButton()).toBeDisabled();
    expect(householdServiceMock.createHousehold).not.toHaveBeenCalled();
  });
});

describe("Mit Code beitreten", () => {
  const codeField = () => screen.getByLabelText("Einladungscode");
  const joinButton = () => screen.getByRole("button", { name: /Beitreten|Tritt bei…/ });

  it("normalises the code and shows the format hint while incomplete", async () => {
    renderOnboarding("/onboarding/join");
    await screen.findByRole("heading", { name: "Mit Code beitreten" });
    expect(
      screen.getByText("Den Code findet dein Mitbewohner unter Haushalt → Einladen."),
    ).toBeInTheDocument();
    await userEvent.type(codeField(), "mst48");
    expect(codeField()).toHaveValue("MST-48");
    expect(codeField()).toHaveAccessibleDescription(
      "Format: drei Buchstaben, Bindestrich, vier Ziffern",
    );
    expect(joinButton()).toBeDisabled();
    expect(invites.getInvite).not.toHaveBeenCalled();
  });

  it("says when a code doesn't exist", async () => {
    renderOnboarding("/onboarding/join");
    await userEvent.type(await screen.findByLabelText("Einladungscode"), " mst4821 ");
    expect(codeField()).toHaveValue("MST-4821");
    expect(
      await screen.findByText("Diesen Code gibt es nicht. Prüfe die Schreibweise."),
    ).toBeInTheDocument();
    expect(invites.getInvite).toHaveBeenCalledWith("MST-4821");
    expect(codeField()).toHaveAttribute("aria-invalid", "true");
    expect(joinButton()).toBeDisabled();
  });

  it("says when a code has expired (D2)", async () => {
    invites.getInvite.mockResolvedValue(
      invite({ createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) }),
    );
    renderOnboarding("/onboarding/join");
    await userEvent.type(await screen.findByLabelText("Einladungscode"), "MST4821");
    expect(
      await screen.findByText("Dieser Code ist abgelaufen. Bitte um einen neuen."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Musterstrasse 12")).not.toBeInTheDocument();
    expect(joinButton()).toBeDisabled();
  });

  it("shows the household for a valid code and joins", async () => {
    invites.getInvite.mockResolvedValue(invite());
    invites.joinHousehold.mockReturnValue(new Promise(() => {}));
    renderOnboarding("/onboarding/join");
    await userEvent.type(await screen.findByLabelText("Einladungscode"), "MST4821");

    expect(await screen.findByText("Code gefunden")).toBeInTheDocument();
    expect(screen.getByText("Musterstrasse 12")).toBeInTheDocument();
    expect(screen.getByText("Nevio · 1 Mitglied")).toBeInTheDocument();
    expect(joinButton()).toBeEnabled();

    await userEvent.click(joinButton());
    expect(invites.joinHousehold).toHaveBeenCalledWith(
      invite({ createdAt: expect.any(Date) }),
      profile,
    );
    expect(screen.getByRole("button", { name: "Tritt bei…" })).toHaveAttribute("aria-busy", "true");
  });

  it("shows «abgelaufen» when the server rejects the join as expired", async () => {
    invites.getInvite.mockResolvedValue(invite({ memberCount: 2 }));
    invites.joinHousehold.mockRejectedValue(new JoinError("expired"));
    renderOnboarding("/onboarding/join");
    await userEvent.type(await screen.findByLabelText("Einladungscode"), "MST4821");
    expect(await screen.findByText("Nevio · 2 Mitglieder")).toBeInTheDocument();

    await userEvent.click(joinButton());
    expect(
      await screen.findByText("Dieser Code ist abgelaufen. Bitte um einen neuen."),
    ).toBeInTheDocument();
    expect(joinButton()).toBeDisabled();
  });

  it("shows a connection error with retry when the lookup fails", async () => {
    invites.getInvite.mockRejectedValueOnce(
      Object.assign(new Error("offline"), { code: "unavailable" }),
    );
    invites.getInvite.mockResolvedValueOnce(invite());
    renderOnboarding("/onboarding/join");
    await userEvent.type(await screen.findByLabelText("Einladungscode"), "MST4821");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Keine Verbindung. Prüf dein Internet und versuch es nochmals.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Nochmals versuchen" }));
    expect(await screen.findByText("Code gefunden")).toBeInTheDocument();
  });

  it("doesn't look up or join while offline (D11)", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderOnboarding("/onboarding/join");
    await userEvent.type(await screen.findByLabelText("Einladungscode"), "MST4821");
    await new Promise((done) => setTimeout(done, 400));
    expect(invites.getInvite).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Keine Verbindung");
    expect(joinButton()).toBeDisabled();
  });
});
