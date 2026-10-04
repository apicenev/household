import { CheckCircleIcon, PlusIcon } from "@heroicons/react/16/solid";
import { ShoppingBagIcon } from "@heroicons/react/24/outline";
import { useRef, useState, type FormEvent } from "react";
import { cleanName, frequentItems, ITEM_NAME_MAX, openItemKeys } from "../../domain/shopping";
import { shoppingCopy } from "../../lib/copy";
import { cx } from "../../lib/cx";
import { useLoadedHousehold } from "../../lib/household/useHousehold";
import type { ShopCategory } from "../../types";
import { QuickChip } from "../tasks/QuickAddTaskForm";
import { Button } from "../ui/Button";
import type { ShoppingContextValue } from "./shoppingContext";

/** Chips of frequent items in the Schnellerfassung (D43). */
const QUICK_CHIPS = 4;

/**
 * Schnellerfassung «Einkauf» (`Sheets.dc.html`, 5.9): «Was braucht ihr?», up to four
 * «Oft gekauft» chips that add at once (D43), «Auf die Liste». The field keeps focus after
 * adding (SHP-09); an open duplicate shows the D36 hint instead of the status line.
 */
export function QuickAddItemForm({ shopping }: { shopping: ShoppingContextValue }) {
  const { items, itemStats } = useLoadedHousehold();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chips = frequentItems(itemStats, openItemKeys(items), QUICK_CHIPS);

  function add(value: string, category?: ShopCategory) {
    const result = shopping.actions.add(value, category);
    if (result.kind === "invalid") {
      if (result.problem === "tooLong") setStatus({ text: shoppingCopy.nameTooLong, ok: false });
      if (result.problem === "reserved") setStatus({ text: shoppingCopy.nameReserved, ok: false });
      return;
    }
    if (result.kind === "duplicate") {
      setStatus({ text: shoppingCopy.duplicateHint(result.item.name), ok: false });
      inputRef.current?.select();
      return;
    }
    setStatus({ text: shoppingCopy.addedStatus(result.name), ok: true });
    setName("");
    inputRef.current?.focus();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (cleanName(name)) add(name);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex h-14 items-center gap-2.5 rounded-[14px] bg-surface px-3.5 ring-2 ring-brand">
        <ShoppingBagIcon aria-hidden="true" className="size-6 shrink-0 text-brand" />
        <input
          ref={inputRef}
          data-autofocus
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setStatus(null);
          }}
          maxLength={ITEM_NAME_MAX}
          placeholder={shoppingCopy.quickAddPlaceholder}
          aria-label={shoppingCopy.quickAddPlaceholder}
          autoComplete="off"
          enterKeyHint="done"
          className="h-full min-w-0 flex-1 bg-transparent text-[18px] text-ink outline-none placeholder:text-ink-subtle"
        />
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((stat) => (
            <QuickChip
              key={stat.key}
              onClick={() => add(stat.name, stat.category)}
              leading={<PlusIcon aria-hidden="true" className="size-4 text-brand" />}
            >
              <span className="sr-only">{shoppingCopy.addNamed(stat.name)}</span>
              <span aria-hidden="true">{stat.name}</span>
            </QuickChip>
          ))}
        </div>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={!cleanName(name)}>
          {shoppingCopy.quickAddCta}
        </Button>
      </div>
      <span
        role="status"
        className={cx(
          "flex items-center gap-1.5 text-body-sm font-medium",
          status?.ok ? "text-success" : "text-ink-muted",
          !status && "sr-only",
        )}
      >
        {status?.ok && <CheckCircleIcon aria-hidden="true" className="size-4" />}
        {status?.text}
      </span>
    </form>
  );
}
