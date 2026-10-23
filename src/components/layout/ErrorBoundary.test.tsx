import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../../lib/auth/useAuth";
import { isChunkLoadError, reloadOnce } from "../../lib/chunkReload";
import { ErrorBoundary } from "./ErrorBoundary";

function Boom({ when }: { when: boolean }): null {
  if (when) throw new Error("kaputt");
  return null;
}

function renderWith(ui: React.ReactNode, user: AuthContextValue["user"] = null) {
  const logout = vi.fn().mockResolvedValue(undefined);
  const auth = { user, logout } as unknown as AuthContextValue;
  const result = render(<AuthContext.Provider value={auth}>{ui}</AuthContext.Provider>);
  return { ...result, logout, auth };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ErrorBoundary (Phase 9 B15, D97)", () => {
  it("shows the crash screen instead of a blank page", () => {
    renderWith(
      <ErrorBoundary>
        <Boom when />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("heading", { name: "Etwas ist schiefgelaufen" })).toBeInTheDocument();
    expect(
      screen.getByText("Lade die Seite neu. Wenn es wieder passiert, melde dich ab und wieder an."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Neu laden" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Abmelden" })).toBeNull();
  });

  it("offers «Abmelden» when signed in", async () => {
    const { logout } = renderWith(
      <ErrorBoundary>
        <Boom when />
      </ErrorBoundary>,
      { uid: "nevio", email: "nevio@example.ch" },
    );
    // jsdom can't navigate; the «not implemented» console error is muted above.
    await userEvent.click(screen.getByRole("button", { name: "Abmelden" }));
    expect(logout).toHaveBeenCalled();
  });

  it("recovers when the reset key changes (navigating away)", () => {
    const { rerender, auth } = renderWith(
      <ErrorBoundary resetKey="/tasks">
        <Boom when />
      </ErrorBoundary>,
    );
    rerender(
      <AuthContext.Provider value={auth}>
        <ErrorBoundary resetKey="/dashboard">
          <Boom when={false} />
          <p>Start</p>
        </ErrorBoundary>
      </AuthContext.Provider>,
    );
    expect(screen.getByText("Start")).toBeInTheDocument();
  });
});

describe("chunk reload (B15)", () => {
  it("recognises failed lazy chunks", () => {
    expect(
      isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: /a.js")),
    ).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new Error("kaputt"))).toBe(false);
  });

  it("reloads once, then lets the crash screen show", () => {
    const reload = vi.fn();
    expect(reloadOnce(reload)).toBe(true);
    expect(reloadOnce(reload)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
