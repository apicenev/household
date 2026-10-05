import { ChevronRightIcon } from "@heroicons/react/16/solid";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { useNavigate } from "react-router-dom";
import { dashboardCopy } from "../../lib/copy";
import { cx } from "../../lib/cx";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { SectionHeader } from "../ui/SectionHeader";
import { Skeleton } from "../ui/Skeleton";

/**
 * The parts every Start section shares (`Dashboard.dc.html`): phones put the header above the
 * card, desktop inside it (padding 12 / 12 / 4 / 20).
 */

/** «Alle Aufgaben ›», «Kalender ›» … in a section header. */
export function SectionLink({ to, children }: { to: string; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <Button
      variant="ghost"
      size="sm"
      trailingIcon={ChevronRightIcon}
      onClick={() => navigate(to)}
      className="pr-1.5"
    >
      {children}
    </Button>
  );
}

export function DashboardSection({
  title,
  count,
  icon,
  tone,
  action,
  desktop,
  children,
  className,
}: {
  title: string;
  count?: ReactNode;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  tone?: "default" | "danger";
  action?: ReactNode;
  desktop: boolean;
  children: ReactNode;
  className?: string;
}) {
  const header = (
    <SectionHeader title={title} count={count} icon={icon} tone={tone} action={action} />
  );
  if (desktop) {
    // The header's own 4 px inset plus 16 px = the designed 20 px.
    return (
      <section className={cx("overflow-hidden rounded-card bg-surface shadow-card", className)}>
        <div className="pt-3 pr-3 pb-1 pl-4">{header}</div>
        {children}
      </section>
    );
  }
  return (
    <section className={cx("flex flex-col gap-2", className)}>
      {header}
      <Card className="overflow-hidden">{children}</Card>
    </section>
  );
}

/** A muted line inside a card when a section is empty (D67, D70, D72). */
export function EmptyLine({ children, desktop }: { children: ReactNode; desktop: boolean }) {
  return (
    <p
      className={cx(
        "text-[15px] leading-[22px] text-ink-muted",
        desktop ? "px-5 pt-1 pb-4" : "px-4 py-4",
      )}
    >
      {children}
    </p>
  );
}

const rowWidths = ["72%", "55%", "64%"];

/** «Start lädt» (`States.dc.html`, D74): three skeleton cards, pulsing. */
export function DashboardSkeleton({ desktop }: { desktop: boolean }) {
  const cards = [
    { title: "34%", rows: desktop ? 3 : 2 },
    { title: "26%", rows: desktop ? 3 : 2 },
    { title: "40%", rows: desktop ? 3 : 2 },
  ];
  return (
    <div
      aria-busy="true"
      className={cx(
        "animate-skeleton",
        desktop ? "grid grid-cols-[1.15fr_1fr_1fr] gap-5" : "flex flex-col gap-6",
      )}
    >
      <span role="status" className="sr-only">
        {dashboardCopy.loading}
      </span>
      {cards.map((card, index) =>
        desktop ? (
          <div
            key={index}
            className="flex flex-col gap-1.5 rounded-card bg-surface px-5 py-4.5 shadow-card"
          >
            <Skeleton className="mb-2 h-4 bg-line" style={{ width: card.title }} />
            {Array.from({ length: card.rows }, (_, row) => (
              <div key={row} className="flex h-13 items-center gap-3">
                <Skeleton className="size-6 shrink-0 rounded-pill" />
                <Skeleton className="h-3 flex-1" style={{ maxWidth: rowWidths[row % 3] }} />
                <Skeleton className="size-7 rounded-pill" />
              </div>
            ))}
          </div>
        ) : (
          <div key={index} className="flex flex-col gap-2.5">
            <Skeleton className="ml-1 h-4 bg-line" style={{ width: card.title }} />
            <div className="rounded-card bg-surface px-4 py-1.5 shadow-card">
              {Array.from({ length: card.rows }, (_, row) => (
                <div key={row} className="flex h-14 items-center gap-3">
                  <Skeleton className="size-6.5 shrink-0 rounded-pill" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3" style={{ width: rowWidths[row % 3] }} />
                    <Skeleton className="h-2.5 w-[30%]" />
                  </div>
                  <Skeleton className="size-7 rounded-pill" />
                </div>
              ))}
            </div>
          </div>
        ),
      )}
    </div>
  );
}
