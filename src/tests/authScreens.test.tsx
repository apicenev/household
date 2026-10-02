import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "../components/auth/LoginForm";
import { AuthContext, type AuthContextValue } from "../lib/auth/useAuth";

function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    profile: null,
    initializing: false,
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function renderWith(ui: React.ReactNode, value: AuthContextValue) {
  return render(<AuthContext.Provider value={value}>{ui}</AuthContext.Provider>);
}

describe("LoginForm", () => {
  it("logs in with the entered credentials", async () => {
    const value = authValue();
    renderWith(<LoginForm />, value);
    await userEvent.type(screen.getByLabelText("E-Mail"), "nevio@example.ch");
    await userEvent.type(screen.getByLabelText("Passwort"), "household-dev{Enter}");
    expect(value.login).toHaveBeenCalledWith("nevio@example.ch", "household-dev");
  });

  it("shows the German credentials error and marks both fields invalid", async () => {
    const value = authValue({
      login: vi.fn().mockRejectedValue({ code: "auth/invalid-credential" }),
    });
    renderWith(<LoginForm />, value);
    await userEvent.type(screen.getByLabelText("E-Mail"), "nevio@example.ch");
    await userEvent.type(screen.getByLabelText("Passwort"), "falsch");
    await userEvent.click(screen.getByRole("button", { name: "Anmelden" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "E-Mail oder Passwort ist falsch. Prüfe deine Angaben und versuch es nochmals.",
    );
    expect(screen.getByLabelText("E-Mail")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Passwort")).toHaveAttribute("aria-invalid", "true");
  });

  it("shows other errors without marking the fields", async () => {
    const value = authValue({
      login: vi.fn().mockRejectedValue({ code: "auth/network-request-failed" }),
    });
    renderWith(<LoginForm />, value);
    await userEvent.type(screen.getByLabelText("E-Mail"), "nevio@example.ch");
    await userEvent.type(screen.getByLabelText("Passwort"), "household-dev{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Keine Verbindung. Prüf dein Internet und versuch es nochmals.",
    );
    expect(screen.getByLabelText("E-Mail")).not.toHaveAttribute("aria-invalid");
  });

  it("disables the fields and shows the loading label while submitting", async () => {
    const value = authValue({ login: vi.fn(() => new Promise<void>(() => {})) });
    renderWith(<LoginForm />, value);
    await userEvent.type(screen.getByLabelText("E-Mail"), "nevio@example.ch");
    await userEvent.type(screen.getByLabelText("Passwort"), "household-dev{Enter}");
    expect(screen.getByRole("button", { name: "Meldet an…" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText("E-Mail")).toBeDisabled();
  });

  it("doesn't submit with an empty field and focuses it instead", async () => {
    const value = authValue();
    renderWith(<LoginForm />, value);
    await userEvent.click(screen.getByRole("button", { name: "Anmelden" }));
    expect(value.login).not.toHaveBeenCalled();
    expect(screen.getByLabelText("E-Mail")).toHaveFocus();
  });

  it("toggles the password visibility", async () => {
    renderWith(<LoginForm />, authValue());
    const password = screen.getByLabelText("Passwort");
    expect(password).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Passwort anzeigen" }));
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Passwort verbergen" })).toBeInTheDocument();
  });

  it("has no sign-up or password-reset links", () => {
    renderWith(<LoginForm />, authValue());
    expect(screen.queryByText(/Registrieren/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Passwort vergessen/)).not.toBeInTheDocument();
    expect(
      screen.getByText("Household ist privat. Zugang nur für eingeladene Personen."),
    ).toBeInTheDocument();
  });
});
