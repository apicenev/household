import { PlusIcon } from "@heroicons/react/16/solid";
import { useId } from "react";
import { shoppingCopy, terms } from "../../lib/copy";
import { cx } from "../../lib/cx";
import type { ItemStat, ShopCategory } from "../../types";

/**
 * «Oft gekauft» (SHP-07, B9): one-tap chips for the top items that aren't on the list.
 * Phones: a label and a row that scrolls edge to edge; desktop: a card with wrapping chips.
 * Hidden when there's nothing to offer.
 */
export function FrequentItems({
  stats,
  desktop,
  onAdd,
}: {
  stats: ItemStat[];
  desktop: boolean;
  onAdd: (name: string, category: ShopCategory) => void;
}) {
  const headingId = useId();
  if (stats.length === 0) return null;

  const chips = stats.map((stat) => (
    <button
      key={stat.key}
      type="button"
      aria-label={shoppingCopy.addNamed(stat.name)}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onAdd(stat.name, stat.category)}
      className={cx(
        "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-pill bg-surface font-medium whitespace-nowrap text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)] transition-transform duration-(--duration-fast)",
        desktop
          ? "h-9 pr-3 pl-2 text-[14px] hovered:bg-sunken"
          : "h-10 pr-3.5 pl-2.5 text-[15px] pressed:scale-[0.96] pressed:bg-brand-soft",
      )}
    >
      <PlusIcon aria-hidden="true" className="size-4 text-brand" />
      {stat.name}
    </button>
  ));

  if (desktop) {
    return (
      <section
        aria-labelledby={headingId}
        className="flex flex-col gap-3 rounded-card bg-surface px-4.5 pt-4 pb-4.5 shadow-card"
      >
        <h2 id={headingId} className="text-[15px] font-semibold text-ink">
          {terms.frequentlyBought}
        </h2>
        <div className="flex flex-wrap gap-2">{chips}</div>
      </section>
    );
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1.5">
      <h2 id={headingId} className="pl-0.5 text-[13px] font-semibold text-ink-muted">
        {terms.frequentlyBought}
      </h2>
      <div className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4">{chips}</div>
    </section>
  );
}
