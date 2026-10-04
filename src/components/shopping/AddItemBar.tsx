import { ClockIcon, PlusCircleIcon } from "@heroicons/react/20/solid";
import { PlusIcon } from "@heroicons/react/24/outline";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import {
  cleanName,
  openItemKeys,
  showAddRow,
  suggest,
  type ItemNameProblem,
} from "../../domain/shopping";
import { shoppingCopy } from "../../lib/copy";
import { cx } from "../../lib/cx";
import { useLoadedHousehold } from "../../lib/household/useHousehold";
import type { ShopCategory } from "../../types";
import { useShopping } from "./shoppingContext";

/** How long the duplicate hint stays (D36). */
export const ADD_HINT_MS = 4000;

interface Option {
  id: string;
  label: string;
  meta?: string;
  name: string;
  category?: ShopCategory;
  isAddRow: boolean;
}

const problemHints: Record<Exclude<ItemNameProblem, "empty">, string> = {
  tooLong: shoppingCopy.nameTooLong,
  reserved: shoppingCopy.nameReserved,
};

/**
 * «Artikel hinzufügen» (`Shopping.dc.html`, SHP-07, SHP-09, B9, B12): a combobox with the
 * suggestion listbox. Enter or «Hinzufügen» adds and empties the field without blurring it,
 * so the phone keyboard stays open for the next item; the buttons and options keep the focus
 * in the field on pointer-down. ↑ / ↓ move through the suggestions, Esc empties the field.
 */
export function AddItemBar({ desktop }: { desktop: boolean }) {
  const { items, itemStats } = useLoadedHousehold();
  const { actions } = useShopping();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const [hint, setHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const hintId = useId();

  useEffect(() => {
    if (!hint) return;
    const timer = window.setTimeout(() => setHint(null), ADD_HINT_MS);
    return () => window.clearTimeout(timer);
  }, [hint]);

  const openKeys = useMemo(() => openItemKeys(items), [items]);
  const suggestions = useMemo(
    () => suggest(query, itemStats, openKeys),
    [query, itemStats, openKeys],
  );
  const cleaned = cleanName(query);
  const options: Option[] = [
    ...(showAddRow(query, suggestions)
      ? [{ id: "add", label: shoppingCopy.addRow(cleaned), name: cleaned, isAddRow: true }]
      : []),
    ...suggestions.map((stat) => ({
      id: stat.key,
      label: stat.name,
      meta: shoppingCopy.timesBought(stat.count),
      name: stat.name,
      category: stat.category,
      isAddRow: false,
    })),
  ];
  const expanded = focused && cleaned.length > 0 && options.length > 0;
  const optionId = (index: number) => `${listId}-${index}`;

  function add(name: string, category?: ShopCategory) {
    const result = actions.add(name, category);
    if (result.kind === "invalid") {
      if (result.problem !== "empty") setHint(problemHints[result.problem]);
      return;
    }
    if (result.kind === "duplicate") {
      setHint(shoppingCopy.duplicateHint(result.item.name));
      inputRef.current?.select();
      return;
    }
    setQuery("");
    setActive(-1);
    setHint(null);
    inputRef.current?.focus();
  }

  function onOptionClick(event: MouseEvent<HTMLDivElement>) {
    const option = options[Number(event.currentTarget.dataset.index)];
    if (option) add(option.name, option.category);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!expanded) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => {
        const next = current + step;
        if (next < -1) return options.length - 1;
        if (next >= options.length) return -1;
        return next;
      });
    } else if (event.key === "Escape") {
      if (query) event.preventDefault();
      setQuery("");
      setActive(-1);
    } else if (event.key === "Enter" && expanded && active >= 0) {
      event.preventDefault();
      const option = options[active];
      if (option) add(option.name, option.category);
    }
  }

  return (
    <form
      role="search"
      aria-label={shoppingCopy.addLabel}
      onSubmit={(event) => {
        event.preventDefault();
        add(query);
      }}
      className="relative flex flex-col gap-1.5"
    >
      <div
        className={cx(
          "flex h-13 items-center gap-2.5 rounded-[14px] bg-surface pr-1.5 pl-3.5 transition-shadow duration-(--duration-fast)",
          focused && !desktop
            ? "shadow-[0_0_0_2px_var(--color-brand),var(--shadow-raised)]"
            : "shadow-card focus-within:shadow-[0_0_0_2px_var(--color-brand),var(--shadow-card)]",
        )}
      >
        <PlusIcon aria-hidden="true" className="size-6 shrink-0 text-brand" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={shoppingCopy.addLabel}
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
          aria-describedby={hint ? hintId : undefined}
          placeholder={desktop ? shoppingCopy.addPlaceholderDesktop : shoppingCopy.addLabel}
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="enter"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(-1);
            setHint(null);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={cx(
            "h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-subtle",
            desktop ? "text-body" : "text-[17px]",
          )}
        />
        {desktop ? (
          <span
            aria-hidden="true"
            className="flex h-6 items-center rounded-xs bg-sunken px-1.75 font-mono text-[12px] font-semibold text-ink-muted"
          >
            ↵
          </span>
        ) : (
          cleaned.length > 0 && (
            <button
              type="submit"
              onMouseDown={(event) => event.preventDefault()}
              className="h-10 shrink-0 cursor-pointer rounded-[10px] bg-brand px-3.5 text-[15px] font-semibold text-on-brand pressed:bg-brand-hover"
            >
              {shoppingCopy.addButton}
            </button>
          )
        )}
      </div>

      <div
        id={listId}
        role="listbox"
        aria-label={shoppingCopy.suggestions}
        hidden={!expanded}
        className="absolute top-14.5 right-0 left-0 z-30 flex flex-col rounded-[14px] bg-surface p-1.5 shadow-raised"
      >
        {expanded &&
          options.map((option, index) => (
            <div
              key={option.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => event.preventDefault()}
              data-index={index}
              onClick={onOptionClick}
              className={cx(
                "flex min-h-12 cursor-pointer items-center gap-3 rounded-[10px] px-2.5 text-ink hovered:bg-sunken",
                index === active ? "bg-sunken" : option.isAddRow && "bg-brand-soft",
              )}
            >
              {option.isAddRow ? (
                <PlusCircleIcon aria-hidden="true" className="size-5 shrink-0 text-brand" />
              ) : (
                <ClockIcon aria-hidden="true" className="size-5 shrink-0 text-ink-subtle" />
              )}
              <span className="min-w-0 flex-1 truncate text-body">{option.label}</span>
              {option.meta && (
                <span className="shrink-0 text-[13px] text-ink-muted tabular-nums">
                  {option.meta}
                </span>
              )}
            </div>
          ))}
      </div>

      <p
        id={hintId}
        aria-live="polite"
        className="min-h-0 px-1 text-[14px] text-ink-muted empty:hidden"
      >
        {hint}
      </p>
    </form>
  );
}
