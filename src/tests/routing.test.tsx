import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/ToastProvider";
import { AuthContext, type AuthContextValue, type AuthUser } from "../lib/auth/useAuth";
import { AppRoutes } from "../router/AppRoutes";

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
      initializing: false,
      ...initial,
      login: async (email, password) => {
        login(email, password);
        set((current) => ({ ...current, user: nevio }));
      },
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
const signedIn = { user: nevio };

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

  it("opens the Schnellerfassung from the + with «Bald verfügbar» entries", async () => {
    renderApp("/dashboard", signedIn);
    await userEvent.click(await screen.findByRole("button", { name: "Schnellerfassung" }));
    const sheet = screen.getByRole("dialog", { name: "Schnellerfassung" });
    expect(within(sheet).getByRole("heading", { name: "Aufgabe" })).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole("radio", { name: "Einkauf" }));
    expect(within(sheet).getByRole("heading", { name: "Einkauf" })).toBeInTheDocument();
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
