import { TrashIcon } from "@heroicons/react/24/outline";
import { useId, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { actions } from "../../lib/copy";
import { Button } from "./Button";
import { Sheet } from "./Sheet";
import { controlClasses } from "./fieldStyles";
import { cx } from "../../lib/cx";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** Runs the destructive action; a returned promise shows the loading state. */
  onConfirm: () => void | Promise<void>;
  /** «„Bad putzen“ löschen?» — also the accessible name. */
  title: string;
  text?: ReactNode;
  /** Danger button label, e.g. «Löschen», «Haushalt löschen». */
  confirmLabel: string;
  /** Shown while onConfirm runs, e.g. «Löscht…». */
  loadingLabel?: string;
  /** 24/outline icon in the danger-soft circle (default trash). */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /** Typed confirmation: the danger button unlocks once this exact text is entered. */
  confirmText?: string;
  /** Extra content between text and buttons (e.g. «Nur diese / Ganze Serie»). */
  children?: ReactNode;
}

/**
 * Final confirmation of a destructive action: bottom sheet with stacked buttons on mobile,
 * dialog with right-aligned buttons from lg. The danger button is the only red fill;
 * the entry point that opens it is a danger-ghost button.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  text,
  confirmLabel,
  loadingLabel = "Löscht…",
  icon: Icon = TrashIcon,
  confirmText,
  children,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const locked = confirmText !== undefined && typed.trim() !== confirmText;

  function close() {
    if (busy) return;
    setTyped("");
    onClose();
  }

  async function confirm() {
    if (locked || busy) return;
    setBusy(true);
    try {
      await onConfirm();
      setTyped("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={title}
      hideHeader
      role="alertdialog"
      size="sm"
      bodyClassName="gap-4 pt-2 lg:p-6"
    >
      <span className="flex size-11 items-center justify-center rounded-pill bg-danger-soft text-danger">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[19px] leading-[26px] font-semibold text-ink">{title}</h2>
        {text && <p className="text-[15px] leading-[22px] text-ink-muted">{text}</p>}
      </div>
      {children}
      {confirmText !== undefined && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={inputId} className="text-body-sm font-semibold">
            Gib{" "}
            <span className="rounded-[4px] bg-sunken px-1.25 py-px font-mono">{confirmText}</span>{" "}
            zur Bestätigung ein
          </label>
          <input
            id={inputId}
            data-autofocus
            value={typed}
            placeholder={confirmText}
            autoComplete="off"
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void confirm();
            }}
            className={cx(
              controlClasses({}),
              "h-12 px-3.5 focus:border-danger focus:ring-danger-soft",
            )}
          />
        </div>
      )}
      <div className="flex flex-col-reverse gap-2 lg:flex-row lg:justify-end">
        <Button
          variant="secondary"
          size="lg"
          onClick={close}
          disabled={busy}
          data-autofocus={confirmText === undefined ? true : undefined}
          className="w-full lg:h-11 lg:w-auto lg:px-4.5 lg:text-[15px]"
        >
          {actions.cancel}
        </Button>
        <Button
          variant="danger"
          size="lg"
          onClick={() => void confirm()}
          disabled={locked}
          loading={busy}
          loadingLabel={loadingLabel}
          className="w-full lg:h-11 lg:w-auto lg:px-4.5 lg:text-[15px]"
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
