import { ChevronRightIcon, ExclamationCircleIcon } from "@heroicons/react/20/solid";
import { FunnelIcon as Funnel16 } from "@heroicons/react/16/solid";
import { FunnelIcon } from "@heroicons/react/24/outline";
import { useId, useState, type ReactNode } from "react";
import { taskCopy } from "../../lib/copy";
import { cx } from "../../lib/cx";
import { FilterChip } from "../ui/FilterChip";

/**
 * A group of the open list (`Tasks.dc.html`): phones show the heading above the card,
 * desktop inside it. «Überfällig» is red with an icon (B4).
 */
export function TaskGroupSection({
  label,
  count,
  danger = false,
  children,
}: {
  label: string;
  count: number;
  danger?: boolean;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-2 lg:gap-0 lg:overflow-hidden lg:rounded-card lg:bg-surface lg:shadow-card"
    >
      <h2
        id={headingId}
        className={cx(
          "flex h-7 items-center gap-1.5 px-1 text-[15px] font-semibold lg:h-auto lg:px-5 lg:pt-3.5 lg:pb-2",
          danger ? "text-danger" : "text-ink",
        )}
      >
        {danger && <ExclamationCircleIcon aria-hidden="true" className="size-4.5" />}
        {label}
        <span className="font-medium text-ink-muted tabular-nums">{count}</span>
      </h2>
      <ul className="overflow-hidden rounded-card bg-surface shadow-card lg:rounded-none lg:shadow-none">
        {children}
      </ul>
    </section>
  );
}

/** «Erledigt (n)»: collapsed by default, chevron rotates when open (B5). */
export function CompletedSection({ count, children }: { count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <section className="flex flex-col gap-2 lg:gap-0 lg:overflow-hidden lg:rounded-card lg:bg-surface lg:shadow-card">
      <h2 className="flex">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((value) => !value)}
          className="flex h-11 w-full cursor-pointer items-center gap-1.5 px-1 text-left text-[15px] font-semibold text-ink-muted lg:h-13 lg:pr-5 lg:pl-3.5"
        >
          <ChevronRightIcon
            aria-hidden="true"
            className={cx(
              "size-5 transition-transform duration-(--duration-base) ease-out",
              open && "rotate-90",
            )}
          />
          {taskCopy.done} <span className="tabular-nums">({count})</span>
        </button>
      </h2>
      <ul
        id={listId}
        hidden={!open}
        className="overflow-hidden rounded-card bg-surface shadow-card lg:rounded-none lg:shadow-none"
      >
        {children}
      </ul>
    </section>
  );
}

/** «Keine passenden Aufgaben» (designed for phones and desktop). */
export function TaskNoResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-5 py-12 text-center lg:gap-2 lg:rounded-card lg:bg-surface lg:shadow-card">
      <span className="flex size-13 items-center justify-center rounded-pill bg-sunken text-ink-muted lg:size-auto lg:bg-transparent">
        <FunnelIcon aria-hidden="true" className="size-6" />
      </span>
      <h2 className="text-[17px] font-semibold text-ink lg:text-body">{taskCopy.noResults}</h2>
      <p className="text-[15px] text-ink-muted lg:hidden">{taskCopy.noResultsText}</p>
      <button
        type="button"
        onClick={onReset}
        className="mt-1 h-11 cursor-pointer rounded-control px-4 text-[15px] font-semibold text-brand-strong lg:mt-0 lg:h-10 lg:rounded-[10px] lg:px-3.5 lg:text-body-sm hovered:bg-brand-soft"
      >
        {taskCopy.resetFilters}
      </button>
    </div>
  );
}

export interface FilterOption {
  key: string;
  label: string;
  selected: boolean;
  onToggle: () => void;
}

/**
 * The filter chips (B2): phones scroll horizontally edge to edge, desktop wraps with the
 * «Filter» label and «Zurücksetzen».
 */
export function TaskFilterBar({
  options,
  onReset,
  showReset,
}: {
  options: FilterOption[];
  onReset: () => void;
  showReset: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={taskCopy.filters.label}
      className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 py-1 lg:mx-0 lg:flex-wrap lg:items-center lg:overflow-visible lg:px-0"
    >
      <span
        aria-hidden="true"
        className="mr-1 hidden items-center gap-1.5 text-[13px] font-semibold text-ink-muted lg:flex"
      >
        <Funnel16 className="size-4" />
        {taskCopy.filters.label}
      </span>
      {options.map((option) => (
        <FilterChip key={option.key} selected={option.selected} onClick={option.onToggle}>
          {option.label}
        </FilterChip>
      ))}
      {showReset && (
        <button
          type="button"
          onClick={onReset}
          className="hidden h-9 shrink-0 cursor-pointer rounded-[10px] px-2.5 text-body-sm font-semibold text-brand-strong lg:block hovered:bg-brand-soft"
        >
          {taskCopy.filters.reset}
        </button>
      )}
    </div>
  );
}
