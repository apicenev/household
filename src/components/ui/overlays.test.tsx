import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { Menu } from "./Menu";
import { Sheet } from "./Sheet";
import { ToastProvider } from "./ToastProvider";
import { useToast } from "./toastContext";

function SheetHarness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Neue Aufgabe</Button>
      <Sheet
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        title="Neue Aufgabe"
        footer={<Button>Aufgabe hinzufügen</Button>}
      >
        <label>
          Titel
          <input data-autofocus />
        </label>
      </Sheet>
    </>
  );
}

describe("Sheet", () => {
  it("opens as a modal dialog named by its title and focuses [data-autofocus]", async () => {
    render(<SheetHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Neue Aufgabe" }));
    const dialog = screen.getByRole("dialog", { name: "Neue Aufgabe" });
    expect(dialog).toHaveAttribute("open");
    expect(screen.getByLabelText("Titel")).toHaveFocus();
  });

  it("closes with Esc and returns focus to the trigger", async () => {
    const onClose = vi.fn();
    render(<SheetHarness onClose={onClose} />);
    const trigger = screen.getByRole("button", { name: "Neue Aufgabe" });
    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.querySelector("dialog")).not.toHaveAttribute("open");
    expect(trigger).toHaveFocus();
  });

  it("closes with the «Schliessen» button", async () => {
    render(<SheetHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Neue Aufgabe" }));
    await userEvent.click(screen.getByRole("button", { name: "Schliessen" }));
    expect(document.querySelector("dialog")).not.toHaveAttribute("open");
  });

  it("closes on a click on the scrim, not inside the content", async () => {
    const onClose = vi.fn();
    render(<SheetHarness onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Neue Aufgabe" }));
    await userEvent.click(screen.getByLabelText("Titel"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(document.querySelector("dialog")!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("ConfirmDialog", () => {
  it("unlocks the danger button only after the typed confirmation matches", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        onConfirm={onConfirm}
        title="Haushalt löschen?"
        confirmLabel="Haushalt löschen"
        confirmText="Musterstrasse 12"
      />,
    );
    expect(screen.getByRole("alertdialog", { name: "Haushalt löschen?" })).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Haushalt löschen" });
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/zur Bestätigung ein/), "Musterstrasse 1");
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/zur Bestätigung ein/), "2");
    expect(confirm).toBeEnabled();

    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("focuses «Abbrechen» first and cancels", async () => {
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={onClose}
        onConfirm={() => {}}
        title="«Bad putzen» löschen?"
        confirmLabel="Löschen"
      />,
    );
    const cancel = screen.getByRole("button", { name: "Abbrechen" });
    expect(cancel).toHaveFocus();
    await userEvent.click(cancel);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the loading label while the action runs", async () => {
    let finish: () => void = () => {};
    const onConfirm = () => new Promise<void>((resolve) => (finish = resolve));
    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        onConfirm={onConfirm}
        title="«Bad putzen» löschen?"
        confirmLabel="Löschen"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Löschen" }));
    expect(screen.getByRole("button", { name: "Löscht…" })).toHaveAttribute("aria-busy", "true");
    await act(async () => finish());
    expect(screen.getByRole("button", { name: "Löschen" })).toBeInTheDocument();
  });
});

describe("Menu", () => {
  function renderMenu() {
    const onProfile = vi.fn();
    const onLogout = vi.fn();
    render(
      <Menu
        aria-label="Kontomenü"
        items={[
          { label: "Profil", onSelect: onProfile },
          { label: "Gesperrt", onSelect: () => {}, disabled: true },
          { label: "Haushalt", onSelect: () => {} },
          "separator",
          { label: "Abmelden", onSelect: onLogout, danger: true },
        ]}
        trigger={(props) => (
          <button {...props} type="button">
            NA
          </button>
        )}
      />,
    );
    return { onProfile, onLogout, trigger: screen.getByRole("button", { name: "NA" }) };
  }

  it("opens with Enter, focuses the first item and skips disabled ones", async () => {
    const { trigger } = renderMenu();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: "Kontomenü" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Profil" })).toHaveFocus();

    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Haushalt" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Profil" })).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "Abmelden" })).toHaveFocus();
  });

  it("opens on the last item with ArrowUp", async () => {
    const { trigger } = renderMenu();
    trigger.focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Abmelden" })).toHaveFocus();
  });

  it("closes with Esc and returns focus to the trigger", async () => {
    const { trigger } = renderMenu();
    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("runs the selected item and closes", async () => {
    const { onLogout, trigger } = renderMenu();
    await userEvent.click(trigger);
    await userEvent.keyboard("{End}{Enter}");
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on a click outside", async () => {
    const { trigger } = renderMenu();
    await userEvent.click(trigger);
    await userEvent.click(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("ToastProvider", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function ShowButton({ onUndo }: { onUndo: () => void }) {
    const toast = useToast();
    return (
      <Button
        onClick={() =>
          toast.show({
            message: "«Altpapier rausbringen» erledigt",
            action: { label: "Rückgängig", onClick: onUndo },
          })
        }
      >
        Abhaken
      </Button>
    );
  }

  it("announces the toast and runs «Rückgängig»", async () => {
    const onUndo = vi.fn();
    render(
      <ToastProvider>
        <ShowButton onUndo={onUndo} />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Abhaken" }));
    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent("«Altpapier rausbringen» erledigt");
    expect(toast.parentElement).toHaveAttribute("aria-live", "polite");

    await userEvent.click(screen.getByRole("button", { name: "Rückgängig" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("dismisses itself after its duration", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ShowButton onUndo={() => {}} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Abhaken" }));
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(7999));
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("throws a helpful error outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ShowButton onUndo={() => {}} />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
