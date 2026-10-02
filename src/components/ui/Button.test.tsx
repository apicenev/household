import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("calls onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Speichern</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Speichern
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Speichern" });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("shows the German loading label and ignores clicks while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} loading loadingLabel="Speichert…">
        Speichern
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Speichert…" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Abbrechen</Button>);
    expect(screen.getByRole("button", { name: "Abbrechen" })).toHaveAttribute("type", "button");
  });
});
