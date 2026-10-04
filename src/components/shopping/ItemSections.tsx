import { ChevronRightIcon } from "@heroicons/react/20/solid";
import { useId, useState, type ReactNode } from "react";
import { shoppingCopy, terms } from "../../lib/copy";
import { cx } from "../../lib/cx";
import type { ShopCategory } from "../../types";
import { shopCategories } from "../ui/categories";

/**
 * A category group of open items (SHP-05, `Shopping.dc.html`): the 24 px icon tile, label and
 * count. Phones show the heading above the card, desktop inside it.
 */
export function ItemGroupSection({
  category,
  count,
  children,
}: {
  category: ShopCategory;
  count: number;
  children: ReactNode;
}) {
  const headingId = useId();
  const style = shopCategories[category];
  const Icon = style.icon;
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-2 lg:gap-0 lg:overflow-hidden lg:rounded-card lg:bg-surface lg:shadow-card"
    >
      <h2
        id={headingId}
        className="flex h-7 items-center gap-2 px-1 text-[15px] font-semibold text-ink lg:h-auto lg:px-4.5 lg:pt-3.5 lg:pb-2"
      >
        <span
          aria-hidden="true"
          className={cx(
            "flex size-6 items-center justify-center rounded-[7px]",
            style.soft,
            style.main,
          )}
        >
          <Icon className="size-4" />
        </span>
        {style.label}
        <span className="font-medium text-ink-muted tabular-nums">{count}</span>
      </h2>
      <ul className="overflow-hidden rounded-card bg-surface shadow-card lg:rounded-none lg:shadow-none">
        {children}
      </ul>
    </section>
  );
}

/**
 * «Gekauft (n)» (SHP-04, SHP-06, B8): collapsed by default, chevron rotates when open,
 * «Gekaufte entfernen» next to it. Phones: header above the card; desktop: one card.
 */
export function BoughtSection({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <section className="flex flex-col gap-2 lg:gap-0 lg:overflow-hidden lg:rounded-card lg:bg-surface lg:shadow-card">
      <div className="flex items-center justify-between lg:py-1.5 lg:pr-2 lg:pl-1.5">
        <h2 className="flex">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((value) => !value)}
            className="flex h-11 cursor-pointer items-center gap-1.5 rounded-[10px] px-1 text-[15px] font-semibold text-ink-muted lg:px-2 lg:text-ink"
          >
            <ChevronRightIcon
              aria-hidden="true"
              className={cx(
                "size-5 transition-transform duration-(--duration-base) ease-out lg:text-ink-muted",
                open && "rotate-90",
              )}
            />
            {terms.purchased}{" "}
            <span className="tabular-nums lg:font-medium lg:text-ink-muted">({count})</span>
          </button>
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="h-11 cursor-pointer rounded-[10px] px-3 text-[15px] font-semibold text-brand-strong lg:h-9 lg:px-2.5 lg:text-[14px] hovered:bg-brand-soft"
        >
          {terms.clearPurchased}
        </button>
      </div>
      <ul
        id={listId}
        hidden={!open}
        aria-label={shoppingCopy.boughtSection(count)}
        className="overflow-hidden rounded-card bg-surface shadow-card lg:rounded-none lg:shadow-none"
      >
        {children}
      </ul>
    </section>
  );
}
