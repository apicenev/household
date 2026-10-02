import { ChevronRightIcon } from "@heroicons/react/16/solid";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { actions } from "../../lib/copy";
import { cx } from "../../lib/cx";
import { Button } from "./Button";

export interface SectionHeaderProps {
  title: ReactNode;
  /** Muted count next to the title, e.g. «7 offen». */
  count?: ReactNode;
  /** Leading icon (20/solid), e.g. for «Überfällig». */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  tone?: "default" | "danger";
  /** «Alle anzeigen» ghost button on the right. */
  onShowAll?: () => void;
  /** Custom right-hand action (e.g. a link) instead of the default button. */
  action?: ReactNode;
  /** Heading level (default h2). */
  as?: "h2" | "h3";
  className?: string;
}

/** Section title 8 px above its card, with «Alle anzeigen» on the right. */
export function SectionHeader({
  title,
  count,
  icon: Icon,
  tone = "default",
  onShowAll,
  action,
  as: Heading = "h2",
  className,
}: SectionHeaderProps) {
  return (
    <div className={cx("flex min-h-9 items-center justify-between gap-2 pl-1", className)}>
      <Heading
        className={cx(
          "flex items-center gap-2 text-heading",
          tone === "danger" ? "text-danger" : "text-ink",
        )}
      >
        {Icon && <Icon aria-hidden="true" className="size-5" />}
        {title}
        {count !== undefined && (
          <span className="text-body-sm font-medium text-ink-muted">{count}</span>
        )}
      </Heading>
      {action ??
        (onShowAll && (
          <Button
            variant="ghost"
            size="sm"
            trailingIcon={ChevronRightIcon}
            onClick={onShowAll}
            className="pr-1.5"
          >
            {actions.showAll}
          </Button>
        ))}
    </div>
  );
}
