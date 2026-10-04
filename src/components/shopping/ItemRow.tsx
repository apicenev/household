import { ArrowUpTrayIcon } from "@heroicons/react/16/solid";
import { pendingKind } from "../../domain/shopping";
import { useDelayedFlag } from "../../hooks/useDelayedFlag";
import { shoppingCopy } from "../../lib/copy";
import { cx } from "../../lib/cx";
import type { ShoppingItem } from "../../types";
import { Checkbox } from "../ui/Checkbox";

/** The offline note shows only after a write has been pending this long (as Phase 3 B14). */
export const PENDING_NOTE_DELAY_MS = 1000;

const pendingLabels = {
  new: shoppingCopy.pendingNew,
  checked: shoppingCopy.pendingChecked,
  other: shoppingCopy.pending,
} as const;

/** «Warte auf Sync · neu» (`States` → Einkauf · offline, D44). */
function usePendingNote(item: ShoppingItem): string | null {
  const kind = pendingKind(item);
  const show = useDelayedFlag(kind !== null, PENDING_NOTE_DELAY_MS);
  return show && kind ? pendingLabels[kind] : null;
}

function PendingNote({ label, desktop }: { label: string; desktop: boolean }) {
  return (
    <span
      className={cx(
        "flex items-center gap-1 font-medium text-warning",
        desktop ? "text-[13px]" : "text-[13px] leading-[18px]",
      )}
    >
      <ArrowUpTrayIcon aria-hidden="true" className="size-4" />
      {label}
    </span>
  );
}

/**
 * An open item (`Shopping.dc.html`): checkbox, name with the note below, quantity pill on the
 * right. Phones 60 px with dividers from the text, desktop 56 px with a top border.
 */
export function ItemRow({
  item,
  desktop,
  checking,
  onToggle,
  onOpen,
  first,
}: {
  item: ShoppingItem;
  desktop: boolean;
  /** Ticked locally, check not written yet (the 700 ms window, B6). */
  checking: boolean;
  onToggle: () => void;
  /** Opens «Artikel bearbeiten» (D34); the whole row outside the checkbox. */
  onOpen: () => void;
  first: boolean;
}) {
  const pending = usePendingNote(item);
  return (
    <li
      onClick={onOpen}
      className={cx(
        "relative flex cursor-pointer items-center gap-2",
        desktop
          ? "min-h-14 border-t border-line py-1 pr-4 pl-1.5 hovered:bg-sunken"
          : "min-h-15 py-1.5 pr-3.5 pl-1",
      )}
    >
      {!desktop && !first && (
        <span aria-hidden="true" className="absolute top-0 right-0 left-13 h-px bg-line" />
      )}
      <Checkbox
        checked={checking}
        onChange={onToggle}
        onClick={(event) => event.stopPropagation()}
        aria-label={shoppingCopy.checkLabel(item.name)}
        size={desktop ? "sm" : "md"}
      />
      {/* The click bubbles to the row; the button makes it reachable by keyboard. */}
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer flex-col gap-px text-left focus-visible:outline-offset-2"
      >
        <span
          className={cx(
            "font-semibold break-words transition-colors duration-(--duration-base)",
            desktop ? "text-[15px]" : "text-[17px] leading-[23px]",
            checking ? "text-ink-subtle line-through" : "text-ink",
          )}
        >
          {item.name}
        </span>
        {item.notes && (
          <span
            className={cx("text-ink-muted", desktop ? "text-[13px]" : "text-[14px] leading-[19px]")}
          >
            {item.notes}
          </span>
        )}
        {pending && <PendingNote label={pending} desktop={desktop} />}
      </button>
      {item.quantity && (
        <span
          className={cx(
            "flex shrink-0 items-center justify-center rounded-xs bg-sunken font-semibold text-ink tabular-nums",
            desktop ? "h-6 px-2 text-[13px]" : "h-7 min-w-7 px-2.25 text-[15px]",
          )}
        >
          {item.quantity}
        </span>
      )}
    </li>
  );
}

/** A row in «Gekauft (n)»: filled checkbox puts it back on the list, «von Anna» (B10). */
export function BoughtItemRow({
  item,
  buyerName,
  desktop,
  onUncheck,
  onOpen,
  first,
}: {
  item: ShoppingItem;
  buyerName: string | undefined;
  desktop: boolean;
  onUncheck: () => void;
  /** Opens «Artikel bearbeiten» (D34). */
  onOpen: () => void;
  first: boolean;
}) {
  const pending = usePendingNote(item);
  return (
    <li
      onClick={onOpen}
      className={cx(
        "relative flex cursor-pointer items-center gap-2",
        desktop
          ? "min-h-12 border-t border-line pr-4 pl-1.5 hovered:bg-sunken"
          : "min-h-14 py-1 pr-4 pl-1",
      )}
    >
      {!desktop && !first && (
        <span aria-hidden="true" className="absolute top-0 right-0 left-13 h-px bg-line" />
      )}
      <Checkbox
        checked
        onChange={onUncheck}
        onClick={(event) => event.stopPropagation()}
        aria-label={shoppingCopy.uncheckLabel(item.name)}
        size={desktop ? "sm" : "md"}
      />
      <button
        type="button"
        className={cx(
          "min-w-0 flex-1 cursor-pointer text-left break-words text-ink-subtle line-through focus-visible:outline-offset-2",
          desktop ? "text-[14px]" : "text-body",
        )}
      >
        {item.name}
      </button>
      {pending ? (
        <PendingNote label={pending} desktop={desktop} />
      ) : (
        buyerName && (
          <span className={cx("shrink-0 text-ink-muted", desktop ? "text-[12px]" : "text-[13px]")}>
            {shoppingCopy.boughtBy(buyerName)}
          </span>
        )
      )}
    </li>
  );
}
