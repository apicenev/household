import { useId, type ReactNode } from "react";
import { cx } from "../../lib/cx";

/**
 * A section of the Haushalt page (`Household.dc.html`). Phones: 15 px heading above a card.
 * Desktop: the heading (17 px) inside the card. `flush` for lists whose rows run edge to edge
 * (Mitglieder); otherwise the card has 16 / 20 px padding. `note` is a caption under the
 * section (inside the card on desktop).
 */
export function HouseholdSection({
  title,
  count,
  flush = false,
  note,
  id,
  className,
  children,
}: {
  title: string;
  /** Muted count after the title, phones only (desktop shows it in the page header). */
  count?: number;
  flush?: boolean;
  note?: ReactNode;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cx(
        "flex flex-col gap-2 lg:rounded-card lg:bg-surface lg:shadow-card",
        flush ? "lg:gap-0" : "lg:gap-4 lg:p-5",
        className,
      )}
    >
      <h2
        id={headingId}
        className={cx(
          "flex items-baseline gap-2 px-1 text-[15px] font-semibold text-ink lg:px-0 lg:text-heading",
          flush && "lg:px-5 lg:pt-4 lg:pb-2",
        )}
      >
        {title}
        {count !== undefined && " "}
        {count !== undefined && (
          <span className="font-medium text-ink-muted lg:hidden">{count}</span>
        )}
      </h2>
      <div
        className={cx(
          "rounded-card bg-surface shadow-card lg:rounded-none lg:bg-transparent lg:shadow-none",
          !flush && "flex flex-col gap-4 p-4 lg:p-0",
        )}
      >
        {children}
      </div>
      {note && <p className="px-1 text-[13px] leading-[18px] text-ink-muted lg:px-0">{note}</p>}
    </section>
  );
}
