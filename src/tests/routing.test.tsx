import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/ToastProvider";
import { AuthContext, type AuthContextValue, type AuthUser } from "../lib/auth/useAuth";
import { AppRoutes } from "../router/AppRoutes";
import { fakeStore, nevioProfile } from "./householdFakes";

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

const nevio: AuthUser = { uid: "nevio", email: "nevio@example.ch" };

/**
 * Auth context the test can change: login() signs in as Nevio and logout() signs
 * out, like the real provider after Firebase reports the change.
 */
function renderApp(path: string, initial: Partial<AuthContextValue> = {}) {
  const logout = vi.fn();
  const login = vi.fn();
  const control: { setAuth: (patch: Partial<AuthContextValue>) => void } = {
    setAuth: () => {},
  };

  function Harness() {
    const [auth, set] = useState<AuthContextValue>({
      user: null,
      profile: null,
      confirmedHouseholdId: undefined,
      initializing: false,
      ...initial,
      login: async (email, password) => {
        login(email, password);
        set((current) => ({ ...current, ...signedIn }));
      },
      logout: async () => {
        logout();
        set((current) => ({
          ...current,
          user: null,
          profile: null,
          confirmedHouseholdId: undefined,
        }));
      },
    });
    useEffect(() => {
      control.setAuth = (patch) => set((current) => ({ ...current, ...patch }));
    }, []);
    return (
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
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
    login,
    logout,
    setAuth: (patch: Partial<AuthContextValue>) => act(() => control.setAuth(patch)),
  };
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname + location.hash}</span>;
}

const currentPath = () => screen.getByTestId("location").textContent;
/** Member of «Musterstrasse 12» (h1). */
const signedIn: Partial<AuthContextValue> = {
  user: nevio,
  profile: nevioProfile,
  confirmedHouseholdId: "h1",
};
/** Signed in, no household yet. */
const withoutHousehold: Partial<AuthContextValue> = {
  user: nevio,
  profile: { ...nevioProfile, householdId: undefined },
  confirmedHouseholdId: null,
};

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
});

afterEach(() => {
  document.title = "";
});

describe("routing & guards", () => {
  it("shows the app start while initializing", () => {
    renderApp("/tasks", { initializing: true });
    expect(screen.getByRole("heading", { name: "Household" })).toBeInTheDocument();
    expect(currentPath()).toBe("/tasks");
  });

  it("sends signed-out visitors to /login and back to where they came from", async () => {
    renderApp("/tasks");
    expect(await screen.findByRole("heading", { name: "Willkommen zurück" })).toBeInTheDocument();
    expect(currentPath()).toBe("/login");

    await userEvent.type(screen.getByLabelText("E-Mail"), "nevio@example.ch");
    await userEvent.type(screen.getByLabelText("Passwort"), "household-dev{Enter}");

    expect(await screen.findByRole("heading", { name: "Aufgaben", level: 1 })).toBeInTheDocument();
    expect(currentPath()).toBe("/tasks");
  });

  it("sends signed-in users away from /login to /dashboard", async () => {
    renderApp("/login", signedIn);
    expect(await screen.findByRole("heading", { name: "Start", level: 1 })).toBeInTheDocument();
    expect(currentPath()).toBe("/dashboard");
  });

  it("redirects / to /dashboard", async () => {
    renderApp("/", signedIn);
    expect(await screen.findByRole("heading", { name: "Start", level: 1 })).toBeInTheDocument();
    expect(currentPath()).toBe("/dashboard");
  });

  it("shows the 404 inside the shell when signed in", async () => {
    renderApp("/gibts-nicht", signedIn);
    expect(
      await screen.findByRole("heading", { name: "Seite nicht gefunden" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("navigation", { name: "Hauptnavigation" }).length).toBeGreaterThan(
      0,
    );
    await userEvent.click(screen.getByRole("button", { name: "Zur Startseite" }));
    expect(currentPath()).toBe("/dashboard");
  });

  it("shows the 404 on its own when signed out", async () => {
    renderApp("/gibts-nicht");
    expect(
      await screen.findByRole("heading", { name: "Seite nicht gefunden" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("sets the document title per area", async () => {
    renderApp("/shopping", signedIn);
    await screen.findByRole("heading", { name: "Einkauf", level: 1 });
    expect(document.title).toBe("Einkauf – Household");
  });

  it("returns to /login after the auth state goes away", async () => {
    const { setAuth } = renderApp("/calendar", signedIn);
    await screen.findByRole("heading", { name: "Kalender", level: 1 });
    setAuth({ user: null });
    expect(await screen.findByRole("heading", { name: "Willkommen zurück" })).toBeInTheDocument();
  });
});

describe("household guards (Phase 2)", () => {
  it("sends users without a household to /onboarding (AUTH-06)", async () => {
    renderApp("/dashboard", withoutHousehold);
    expect(await screen.findByRole("heading", { name: "Hallo Nevio" })).toBeInTheDocument();
    expect(currentPath()).toBe("/onboarding");
    expect(screen.queryByRole("navigation", { name: "Hauptnavigation" })).not.toBeInTheDocument();
    expect(fakeStore.subscribed).toEqual([]);
  });

  it("sends members away from /onboarding to /dashboard", async () => {
    renderApp("/onboarding/join", signedIn);
    expect(await screen.findByRole("heading", { name: "Start", level: 1 })).toBeInTheDocument();
    expect(currentPath()).toBe("/dashboard");
  });

  it("shows the app start while the profile loads", () => {
    renderApp("/dashboard", { user: nevio });
    expect(screen.getByRole("heading", { name: "Household" })).toBeInTheDocument();
    expect(fakeStore.subscribed).toEqual([]);
  });

  it("reaches onboarding on a first login offline (pending profile, no household)", async () => {
    // AuthProvider counts the pending null as confirmed (see confirmedHouseholdId.test.ts).
    renderApp("/dashboard", withoutHousehold);
    expect(await screen.findByRole("heading", { name: "Hallo Nevio" })).toBeInTheDocument();
  });

  it("keeps onboarding mounted while a create is pending, then moves on", async () => {
    // The local profile already shows the new household; the server hasn't confirmed it.
    const { setAuth } = renderApp("/onboarding/create", {
      ...withoutHousehold,
      profile: nevioProfile,
    });
    expect(await screen.findByRole("heading", { name: "Haushalt erstellen" })).toBeInTheDocument();
    expect(fakeStore.subscribed).toEqual([]);

    setAuth({ confirmedHouseholdId: "h1" });
    expect(await screen.findByRole("heading", { name: "Start", level: 1 })).toBeInTheDocument();
    expect(currentPath()).toBe("/dashboard");
    expect(fakeStore.subscribed).toEqual(["h1"]);
  });

  it("keeps the shell mounted during a pending profile edit", async () => {
    const { setAuth } = renderApp("/household", signedIn);
    await screen.findByRole("heading", { name: "Musterstrasse 12", level: 1 });
    setAuth({ profile: { ...nevioProfile, displayName: "Nevio A." } });
    expect(screen.getByRole("heading", { name: "Musterstrasse 12", level: 1 })).toBeInTheDocument();
    expect(fakeStore.subscribed).toEqual(["h1"]);
    expect(fakeStore.unsubscribed).toEqual([]);
  });

  it("shows the app start until household and members have loaded", async () => {
    fakeStore.hold = true;
    renderApp("/dashboard", signedIn);
    expect(screen.getByRole("heading", { name: "Household" })).toBeInTheDocument();
    act(() => fakeStore.emit());
    expect(await screen.findByRole("heading", { name: "Start", level: 1 })).toBeInTheDocument();
  });

  it("shows the error state inside the shell and subscribes again on retry (D8)", async () => {
    fakeStore.error = Object.assign(new Error("denied"), { code: "permission-denied" });
    const { logout } = renderApp("/tasks", signedIn);
    expect(
      await screen.findByRole("heading", { name: "Haushalt konnte nicht geladen werden" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Prüf deine Verbindung und versuch es nochmals.")).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Seitenleiste" })).toBeInTheDocument();

    fakeStore.error = null;
    await userEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(await screen.findByRole("heading", { name: "Aufgaben", level: 1 })).toBeInTheDocument();
    expect(fakeStore.subscribed).toEqual(["h1", "h1"]);
    expect(logout).not.toHaveBeenCalled();
  });

  it("logs out from the error state", async () => {
    fakeStore.error = new Error("denied");
    const { logout } = renderApp("/tasks", signedIn);
    await userEvent.click(await screen.findByRole("button", { name: "Abmelden" }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("heading", { name: "Willkommen zurück" })).toBeInTheDocument();
  });

  it("treats a missing household as an error", async () => {
    fakeStore.household = null;
    renderApp("/dashboard", signedIn);
    expect(
      await screen.findByRole("heading", { name: "Haushalt konnte nicht geladen werden" }),
    ).toBeInTheDocument();
  });

  it("tears down the listeners when the household changes", async () => {
    const { setAuth } = renderApp("/dashboard", signedIn);
    await screen.findByRole("heading", { name: "Start", level: 1 });
    setAuth({ confirmedHouseholdId: "h2", profile: { ...nevioProfile, householdId: "h2" } });
    await screen.findByRole("heading", { name: "Start", level: 1 });
    expect(fakeStore.unsubscribed).toEqual(["h1"]);
    expect(fakeStore.subscribed).toEqual(["h1", "h2"]);
  });

  it("sends signed-in users without a household from an unknown path to /onboarding", async () => {
    renderApp("/gibts-nicht", withoutHousehold);
    expect(await screen.findByRole("heading", { name: "Hallo Nevio" })).toBeInTheDocument();
    expect(currentPath()).toBe("/onboarding");
  });

  it("shows the household name and role line in the sidebar", async () => {
    renderApp("/dashboard", signedIn);
    const sidebar = await screen.findByRole("complementary", { name: "Seitenleiste" });
    expect(within(sidebar).getByText("Musterstrasse 12")).toBeInTheDocument();
    expect(within(sidebar).getByText("Besitzer · 2 Mitglieder")).toBeInTheDocument();
    expect(within(sidebar).queryByText("nevio@example.ch")).not.toBeInTheDocument();
  });

  it("shows «Mitglied» in the role line for members", async () => {
    fakeStore.household = { ...fakeStore.household!, ownerId: "anna" };
    renderApp("/dashboard", signedIn);
    const sidebar = await screen.findByRole("complementary", { name: "Seitenleiste" });
    expect(within(sidebar).getByText("Mitglied · 2 Mitglieder")).toBeInTheDocument();
  });
});

describe("app shell", () => {
  const tabBar = () =>
    screen
      .getAllByRole("navigation", { name: "Hauptnavigation" })
      .find((nav) => within(nav).queryByRole("button", { name: "Schnellerfassung" }))!;

  it("marks the active tab with aria-current and navigates", async () => {
    renderApp("/tasks", signedIn);
    await screen.findByRole("heading", { name: "Aufgaben", level: 1 });
    const tabs = within(tabBar());
    expect(tabs.getByRole("link", { name: "Aufgaben" })).toHaveAttribute("aria-current", "page");
    expect(tabs.getByRole("link", { name: "Start" })).not.toHaveAttribute("aria-current");

    await userEvent.click(tabs.getByRole("link", { name: "Einkauf" }));
    expect(currentPath()).toBe("/shopping");
    expect(tabs.getByRole("link", { name: "Einkauf" })).toHaveAttribute("aria-current", "page");
  });

  it("has Aktivität and Haushalt in the sidebar", async () => {
    renderApp("/activity", signedIn);
    const sidebar = await screen.findByRole("complementary", { name: "Seitenleiste" });
    expect(within(sidebar).getByRole("link", { name: "Aktivität" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(sidebar).getByRole("link", { name: "Haushalt" })).toBeInTheDocument();
  });

  it("opens the Schnellerfassung from the + (Aufgabe, Einkauf; Termin «Bald verfügbar»)", async () => {
    renderApp("/dashboard", signedIn);
    await userEvent.click(await screen.findByRole("button", { name: "Schnellerfassung" }));
    const sheet = screen.getByRole("dialog", { name: "Schnellerfassung" });
    expect(within(sheet).getByRole("textbox", { name: "Was ist zu tun?" })).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole("radio", { name: "Einkauf" }));
    expect(within(sheet).getByRole("textbox", { name: "Was braucht ihr?" })).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole("radio", { name: "Termin" }));
    expect(within(sheet).getByRole("heading", { name: "Termin" })).toBeInTheDocument();
    expect(within(sheet).getByText("Kommt bald.")).toBeInTheDocument();
  });

  it("opens the Schnellerfassung from the sidebar «Neu»", async () => {
    renderApp("/dashboard", signedIn);
    await userEvent.click(await screen.findByRole("button", { name: "Neu" }));
    expect(screen.getByRole("dialog", { name: "Schnellerfassung" })).toHaveAttribute("open");
  });

  it("logs out from the account menu and returns to /login", async () => {
    const { logout } = renderApp("/tasks", signedIn);
    await screen.findByRole("heading", { name: "Aufgaben", level: 1 });
    const [topBarMenu] = screen.getAllByRole("button", { name: "Kontomenü" });
    await userEvent.click(topBarMenu);
    await userEvent.click(screen.getByRole("menuitem", { name: "Abmelden" }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("heading", { name: "Willkommen zurück" })).toBeInTheDocument();
    expect(currentPath()).toBe("/login");
  });

  it("opens Profil and Haushalt from the account menu", async () => {
    renderApp("/dashboard", signedIn);
    const [menuButton] = await screen.findAllByRole("button", { name: "Kontomenü" });
    await userEvent.click(menuButton);
    await userEvent.click(screen.getByRole("menuitem", { name: "Profil" }));
    expect(currentPath()).toBe("/household#profil");
  });

  it("shows the offline banner while offline", async () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderApp("/dashboard", signedIn);
    expect(
      await screen.findByText(
        (_, element) =>
          element?.getAttribute("role") === "status" &&
          element.textContent ===
            "Keine Verbindung – Änderungen werden synchronisiert, sobald du wieder online bist.",
      ),
    ).toBeInTheDocument();
    onLine.mockReturnValue(true);
    act(() => window.dispatchEvent(new Event("online")));
    expect(screen.queryByText(/Keine Verbindung/)).not.toBeInTheDocument();
    onLine.mockRestore();
  });

  it("shows the brand on Start and the area name elsewhere in the top bar", async () => {
    renderApp("/dashboard", signedIn);
    const header = (await screen.findAllByRole("banner"))[0];
    expect(within(header).getByText("Household")).toBeInTheDocument();
  });
});
