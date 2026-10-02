import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import { HomeModernIcon } from "@heroicons/react/16/solid";
import type { ReactNode } from "react";
import { useCurrentMember } from "../../lib/auth/useCurrentMember";
import { actions } from "../../lib/copy";
import { cx } from "../../lib/cx";
import { Avatar } from "../ui/Avatar";
import { IconButton } from "../ui/IconButton";
import { AccountMenu } from "./AccountMenu";

export type TopBarProps =
  | {
      /** Top-level page: title (or the brand on Start) left, account avatar right. */
      variant?: "root";
      /** Page title; omit for the brand header on Start. */
      title?: string;
      className?: string;
    }
  | {
      /** Detail screen: back button, centred title, optional action (e.g. «Bearbeiten»). */
      variant: "pushed";
      title: string;
      onBack: () => void;
      action?: ReactNode;
      className?: string;
    };

/** Mobile header (below lg), 56 px, sticky on canvas. */
export function TopBar(props: TopBarProps) {
  return (
    <header
      className={cx("sticky top-0 z-20 bg-canvas pt-[env(safe-area-inset-top)]", props.className)}
    >
      {props.variant === "pushed" ? (
        <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center px-2">
          <IconButton
            aria-label={actions.back}
            icon={ChevronLeftIcon}
            variant="brand"
            onClick={props.onBack}
          />
          <span className="truncate text-heading">{props.title}</span>
          <span className="flex justify-end">{props.action}</span>
        </div>
      ) : (
        <div className="flex h-14 items-center justify-between pr-2 pl-4">
          {props.title ? (
            <span className="truncate font-display text-title">{props.title}</span>
          ) : (
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="flex size-7 items-center justify-center rounded-[8px] bg-brand text-on-brand"
              >
                <HomeModernIcon className="size-4" />
              </span>
              <span className="font-display text-[21px] font-medium tracking-[-0.01em]">
                Household
              </span>
            </span>
          )}
          <AccountTrigger />
        </div>
      )}
    </header>
  );
}

function AccountTrigger() {
  const member = useCurrentMember();
  return (
    <AccountMenu
      trigger={(props) => (
        <button
          {...props}
          type="button"
          aria-label="Kontomenü"
          className="flex size-11 cursor-pointer items-center justify-center rounded-pill"
        >
          <Avatar initials={member.initials} color={member.avatarColor} size={34} />
        </button>
      )}
    />
  );
}
