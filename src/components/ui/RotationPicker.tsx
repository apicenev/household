import { ArrowRightIcon, Bars2Icon } from "@heroicons/react/16/solid";
import { ChevronDownIcon, ChevronLeftIcon, ChevronUpIcon } from "@heroicons/react/20/solid";
import { Fragment } from "react";
import { moveInOrder } from "../../domain/rotation";
import { recurrenceCopy } from "../../lib/copy";
import { cx } from "../../lib/cx";
import type { Member } from "../../types";
import { Avatar } from "./Avatar";

export interface RotationPickerProps {
  /** Member uids in order; the first is «Diesmal» (the current assignee). */
  order: string[];
  onChange: (order: string[]) => void;
  members: readonly Member[];
  /**
   * list: rows with ↑ / ↓ (phones, and /household D30) · chips: horizontal chips with ←
   * (desktop dialog).
   */
  variant?: "list" | "chips";
  /** Badge on the first entry («Diesmal»); none for the household default order. */
  firstBadge?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

/**
 * Ordered member list of a rotation (`Sheets.dc.html`, `Components.dc.html`, RTK-05). The drag
 * handle is visual only; the order changes with the buttons. Former members (not in
 * `members`) are left out.
 */
export function RotationPicker({
  order,
  onChange,
  members,
  variant = "list",
  firstBadge,
  disabled = false,
  "aria-label": ariaLabel,
}: RotationPickerProps) {
  const entries = order
    .map((uid) => members.find((member) => member.uid === uid))
    .filter((member): member is Member => member !== undefined);
  const move = (from: number, to: number) =>
    onChange(
      moveInOrder(
        entries.map((member) => member.uid),
        from,
        to,
      ),
    );

  if (variant === "chips") {
    return (
      <ol aria-label={ariaLabel} className="flex flex-wrap items-center gap-2">
        {entries.map((member, index) => (
          <Fragment key={member.uid}>
            {index > 0 && (
              <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0 text-ink-subtle" />
            )}
            <li className="flex h-9 items-center gap-1.5 rounded-pill bg-sunken pr-1 pl-0.75 text-[14px] font-semibold text-ink">
              <Avatar initials={member.initials} color={member.avatarColor} size={30} />
              {member.displayName}
              <button
                type="button"
                aria-label={recurrenceCopy.moveForward(member.displayName)}
                onClick={() => move(index, index - 1)}
                disabled={disabled || index === 0}
                className="flex size-7 cursor-pointer items-center justify-center rounded-pill text-ink-muted disabled:cursor-not-allowed disabled:text-line-strong hovered:bg-line"
              >
                <ChevronLeftIcon aria-hidden="true" className="size-4" />
              </button>
            </li>
          </Fragment>
        ))}
      </ol>
    );
  }

  return (
    <ol aria-label={ariaLabel} className="flex flex-col gap-1.5">
      {entries.map((member, index) => (
        <li
          key={member.uid}
          className="flex min-h-14 items-center gap-2.5 rounded-control bg-sunken pr-1 pl-2"
        >
          <Bars2Icon aria-hidden="true" className="size-4 shrink-0 text-ink-subtle" />
          <Avatar initials={member.initials} color={member.avatarColor} size={32} />
          <span
            className={cx(
              "flex-1 text-body font-medium",
              disabled ? "text-ink-subtle" : "text-ink",
            )}
          >
            {member.displayName}
          </span>
          {index === 0 && firstBadge && (
            <span className="flex h-5.5 items-center rounded-xs bg-brand-soft px-2 text-[12px] font-semibold text-brand-strong">
              {firstBadge}
            </span>
          )}
          <MoveButton
            label={recurrenceCopy.moveUp(member.displayName)}
            onClick={() => move(index, index - 1)}
            disabled={disabled || index === 0}
            direction="up"
          />
          <MoveButton
            label={recurrenceCopy.moveDown(member.displayName)}
            onClick={() => move(index, index + 1)}
            disabled={disabled || index === entries.length - 1}
            direction="down"
          />
        </li>
      ))}
    </ol>
  );
}

function MoveButton({
  label,
  onClick,
  disabled,
  direction,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  direction: "up" | "down";
}) {
  const Icon = direction === "up" ? ChevronUpIcon : ChevronDownIcon;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-10 cursor-pointer items-center justify-center rounded-control text-ink-muted disabled:cursor-not-allowed disabled:text-line-strong hovered:bg-line"
    >
      <Icon aria-hidden="true" className="size-5" />
    </button>
  );
}
