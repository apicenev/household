import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./Checkbox";

function Controlled({ initial = false }: { initial?: boolean }) {
  const [checked, setChecked] = useState(initial);
  return <Checkbox aria-label="Altpapier rausbringen" checked={checked} onChange={setChecked} />;
}

describe("Checkbox", () => {
  it("toggles on click", async () => {
    render(<Controlled />);
    const box = screen.getByRole("checkbox", { name: "Altpapier rausbringen" });
    expect(box).toHaveAttribute("aria-checked", "false");
    await userEvent.click(box);
    expect(box).toHaveAttribute("aria-checked", "true");
    await userEvent.click(box);
    expect(box).toHaveAttribute("aria-checked", "false");
  });

  it("is keyboard-operable with Space and Enter", async () => {
    render(<Controlled />);
    const box = screen.getByRole("checkbox", { name: "Altpapier rausbringen" });
    await userEvent.tab();
    expect(box).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(box).toHaveAttribute("aria-checked", "true");
    await userEvent.keyboard("{Enter}");
    expect(box).toHaveAttribute("aria-checked", "false");
  });

  it("does not change when disabled", async () => {
    const onChange = vi.fn();
    render(<Checkbox aria-label="Aufgabe" checked={false} disabled onChange={onChange} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Aufgabe" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not change while syncing and reports busy", async () => {
    const onChange = vi.fn();
    render(<Checkbox aria-label="Aufgabe" checked={false} syncing onChange={onChange} />);
    const box = screen.getByRole("checkbox", { name: "Aufgabe" });
    expect(box).toHaveAttribute("aria-busy", "true");
    await userEvent.click(box);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("marks overdue with the danger ring", () => {
    render(<Checkbox aria-label="Aufgabe" checked={false} overdue onChange={() => {}} />);
    const ring = screen.getByRole("checkbox", { name: "Aufgabe" }).firstElementChild;
    expect(ring).toHaveClass("border-danger");
  });
});
