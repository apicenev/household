import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { DateField } from "./DateField";
import { FilterChip } from "./FilterChip";
import { SegmentedControl } from "./SegmentedControl";
import { TextField } from "./TextField";
import { Textarea } from "./Textarea";
import { Toggle } from "./Toggle";

describe("TextField", () => {
  it("labels the input and wires the helper text", () => {
    render(<TextField label="E-Mail" helper="Wir nutzen sie nur zum Anmelden." />);
    const input = screen.getByLabelText("E-Mail");
    expect(input).toHaveAccessibleDescription("Wir nutzen sie nur zum Anmelden.");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("shows the error instead of the helper and marks the input invalid", () => {
    render(
      <TextField label="Titel" helper="Kurz und klar." error="Gib der Aufgabe einen Namen." />,
    );
    const input = screen.getByLabelText("Titel");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Gib der Aufgabe einen Namen.");
    expect(screen.queryByText("Kurz und klar.")).not.toBeInTheDocument();
  });
});

describe("Textarea", () => {
  it("counts characters against maxLength", async () => {
    render(<Textarea label="Notizen" maxLength={500} />);
    await userEvent.type(screen.getByLabelText("Notizen"), "Hallo");
    expect(screen.getByText("5 / 500")).toBeInTheDocument();
  });
});

describe("Toggle", () => {
  it("switches with click and keyboard", async () => {
    function Controlled() {
      const [on, setOn] = useState(false);
      return <Toggle label="Ganztägig" checked={on} onChange={setOn} />;
    }
    render(<Controlled />);
    const toggle = screen.getByRole("switch", { name: "Ganztägig" });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await userEvent.keyboard(" ");
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });
});

describe("SegmentedControl", () => {
  function Controlled() {
    const [value, setValue] = useState("task");
    return (
      <SegmentedControl
        aria-label="Art"
        value={value}
        onChange={setValue}
        options={[
          { value: "task", label: "Aufgabe" },
          { value: "item", label: "Artikel" },
          { value: "event", label: "Termin" },
        ]}
      />
    );
  }

  it("has one tab stop and moves the selection with arrow keys", async () => {
    render(<Controlled />);
    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "Aufgabe" })).toHaveFocus();

    await userEvent.keyboard("{ArrowRight}");
    const item = screen.getByRole("radio", { name: "Artikel" });
    expect(item).toHaveFocus();
    expect(item).toHaveAttribute("aria-checked", "true");

    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Termin" })).toHaveAttribute("aria-checked", "true");

    await userEvent.tab();
    expect(document.body).toHaveFocus();
  });
});

describe("FilterChip", () => {
  it("exposes the selection via aria-pressed", () => {
    render(
      <>
        <FilterChip selected>Meine</FilterChip>
        <FilterChip>Heute</FilterChip>
      </>,
    );
    expect(screen.getByRole("button", { name: "Meine" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Heute" })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("DateField", () => {
  const today = new Date("2026-09-30T10:00:00Z"); // Wednesday

  function Controlled({ initial = "" }: { initial?: string }) {
    const [value, setValue] = useState(initial);
    return (
      <DateField label="Fällig am" value={value} onChange={setValue} quickPicks today={today} />
    );
  }

  it("shows the date in de-CH and can be cleared", async () => {
    render(<Controlled initial="2026-10-03" />);
    expect(screen.getByText("Sa., 3. Okt.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Datum entfernen" }));
    expect(screen.getByText("Ohne Datum")).toBeInTheDocument();
  });

  it("offers Heute / Morgen / Sa. quick picks", async () => {
    render(<Controlled />);
    await userEvent.click(screen.getByRole("button", { name: "Morgen, Do., 1. Okt." }));
    expect(screen.getByText("Do., 1. Okt.")).toBeInTheDocument();
    const saturday = screen.getByRole("button", { name: "Sa., 3. Okt." });
    expect(saturday).toHaveTextContent("Sa.");
    await userEvent.click(saturday);
    expect(saturday).toHaveAttribute("aria-pressed", "true");
  });
});
