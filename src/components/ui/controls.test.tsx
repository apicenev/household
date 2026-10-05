import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { DateField } from "./DateField";
import { DatePill, TimePill } from "./DateTimePill";
import {
  eventPickerFromRule,
  pickerFromRule,
  type EventPickerState,
  type PickerState,
} from "../../domain/recurrence";
import { FilterChip } from "./FilterChip";
import { RecurrencePicker } from "./RecurrencePicker";
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

  it("can act as tabs (tablist / tab with aria-selected)", async () => {
    function Tabs() {
      const [value, setValue] = useState("month");
      return (
        <SegmentedControl
          aria-label="Ansicht"
          semantics="tabs"
          value={value}
          onChange={setValue}
          options={[
            { value: "month", label: "Monat" },
            { value: "upcoming", label: "Demnächst" },
          ]}
        />
      );
    }
    render(<Tabs />);
    expect(screen.getByRole("tablist", { name: "Ansicht" })).toBeInTheDocument();
    const month = screen.getByRole("tab", { name: "Monat" });
    expect(month).toHaveAttribute("aria-selected", "true");
    expect(month).not.toHaveAttribute("aria-checked");
    await userEvent.click(screen.getByRole("tab", { name: "Demnächst" }));
    expect(screen.getByRole("tab", { name: "Demnächst" })).toHaveAttribute("aria-selected", "true");
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

describe("DatePill / TimePill (Phase 6 D48)", () => {
  function Pills({ invalid = false }: { invalid?: boolean }) {
    const [date, setDate] = useState("2026-10-03");
    const [time, setTime] = useState("10:00");
    return (
      <>
        <DatePill label="Beginn, Datum" value={date} onChange={setDate} />
        <TimePill label="Beginn, Uhrzeit" value={time} onChange={setTime} invalid={invalid} />
      </>
    );
  }

  it("shows the value and changes it through the native input", () => {
    render(<Pills />);
    expect(screen.getByText("Sa., 3. Okt.")).toBeInTheDocument();
    const date = screen.getByLabelText("Beginn, Datum");
    expect(date).toHaveAttribute("type", "date");
    fireEvent.change(date, { target: { value: "2026-10-14" } });
    expect(screen.getByText("Mi., 14. Okt.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Beginn, Uhrzeit"), { target: { value: "19:30" } });
    expect(screen.getByText("19:30")).toBeInTheDocument();
  });

  it("ignores clearing (a start is required) and marks invalid values", () => {
    render(<Pills invalid />);
    fireEvent.change(screen.getByLabelText("Beginn, Datum"), { target: { value: "" } });
    expect(screen.getByText("Sa., 3. Okt.")).toBeInTheDocument();
    expect(screen.getByLabelText("Beginn, Uhrzeit")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("RecurrencePicker (Phase 4; event mode Phase 7)", () => {
  function TaskPicker() {
    const [value, setValue] = useState<PickerState>(() => pickerFromRule(undefined, "2026-10-03"));
    return (
      <RecurrencePicker value={value} onChange={setValue} dueDate="2026-10-03" weekStartsOn={1} />
    );
  }

  function EventPicker({ start = "2026-10-03" }: { start?: string }) {
    const [value, setValue] = useState<EventPickerState>(() =>
      eventPickerFromRule(undefined, start),
    );
    return (
      <RecurrencePicker
        mode="event"
        value={value}
        onChange={setValue}
        dueDate={start}
        weekStartsOn={1}
      />
    );
  }

  it("task mode has no monthly segment and no «Endet»", async () => {
    render(<TaskPicker />);
    await userEvent.click(screen.getByRole("button", { name: "Monatlich" }));
    expect(screen.getByText("Monatlich am 3.")).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Am 1. Samstag" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Endet" })).not.toBeInTheDocument();
  });

  it("event mode: «Endet» only while repeating; the monthly segment names the 5th as «letzten»", async () => {
    render(<EventPicker start="2026-10-31" />);
    expect(screen.queryByRole("radiogroup", { name: "Endet" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Monatlich" }));
    expect(screen.getByRole("radiogroup", { name: "Endet" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Am letzten Samstag" }));
    expect(screen.getByText("Monatlich am letzten Samstag")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Am 31." }));
    expect(screen.getByText("Monatlich am 31.")).toBeInTheDocument();
  });

  it("event mode: the «Nach N Mal» stepper stays within 2–99", async () => {
    render(<EventPicker />);
    await userEvent.click(screen.getByRole("button", { name: "Täglich" }));
    await userEvent.click(screen.getByRole("radio", { name: "Nach N Mal" }));
    const less = screen.getByRole("button", { name: "Weniger" });
    for (let i = 0; i < 8; i++) await userEvent.click(less);
    expect(screen.getByText("Täglich · 2 Mal")).toBeInTheDocument();
    expect(less).toBeDisabled();
    await userEvent.click(screen.getByRole("radio", { name: "Nie" }));
    expect(screen.queryByText("Täglich · 2 Mal")).not.toBeInTheDocument();
  });
});
