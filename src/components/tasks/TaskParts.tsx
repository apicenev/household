import {
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  CalendarIcon,
  ExclamationCircleIcon,
  MinusCircleIcon,
} from "@heroicons/react/16/solid";
import { dueGroup } from "../../domain/tasks";
import { taskCopy, terms } from "../../lib/copy";
import { cx } from "../../lib/cx";
import { dueLabel } from "../../lib/format";
import type { Member } from "../../types";
import { Avatar, type AvatarSize } from "../ui/Avatar";

/**
 * Due date with its icon (B11): danger + exclamation-circle when overdue, minus-circle for
 * «Ohne Datum», calendar otherwise.
 */
export function TaskDueLabel({
  dueDate,
  today,
  timeZone,
  className,
}: {
  dueDate: string | null;
  today: string;
  timeZone: string;
  className?: string;
}) {
  const group = dueGroup(dueDate, today);
  const Icon =
    group === "overdue" ? ExclamationCircleIcon : group === "none" ? MinusCircleIcon : CalendarIcon;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 tabular-nums",
        group === "overdue" ? "font-semibold text-danger" : "font-medium",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="sr-only">{taskCopy.dueOn}: </span>
      {dueLabel(dueDate, today, timeZone)}
      {group === "overdue" && <span className="sr-only"> ({terms.overdue})</span>}
    </span>
  );
}

/**
 * The assignee's avatar with their name as tooltip; a dashed empty circle for «Nicht
 * zugewiesen» (also for someone who is no longer a member, D23).
 */
export function TaskAssigneeAvatar({
  member,
  size = 28,
  className,
}: {
  member: Member | undefined;
  size?: Extract<AvatarSize, 26 | 28 | 30 | 32>;
  className?: string;
}) {
  if (!member) {
    return (
      <span
        role="img"
        aria-label={terms.unassigned}
        title={terms.unassigned}
        className={cx(
          "inline-flex shrink-0 rounded-pill border-[1.5px] border-dashed border-control",
          size === 26 && "size-6.5",
          size === 28 && "size-7",
          size === 30 && "size-7.5",
          size === 32 && "size-8",
          className,
        )}
      />
    );
  }
  return (
    <span title={member.displayName} className={cx("inline-flex shrink-0", className)}>
      <Avatar
        initials={member.initials}
        color={member.avatarColor}
        size={size}
        name={member.displayName}
      />
    </span>
  );
}

/** What a row shows of a recurring task (Phase 4 B10): short rule and rotation order. */
export interface TaskRepeatInfo {
  /** «Wöchentlich», «Alle 4 Tage» */
  rule: string;
  /** «Nevio → Anna» */
  rotation?: string;
}

/**
 * «↻ Wöchentlich» and «⇄ Nevio → Anna» in a row's meta line (`Tasks.dc.html`: 14 px icons,
 * 3 px gap). Two siblings, so they wrap with the due label.
 */
export function TaskRepeatMeta({ repeat }: { repeat: TaskRepeatInfo }) {
  return (
    <>
      <span className="inline-flex items-center gap-0.75">
        <ArrowPathIcon aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="sr-only">{terms.repeat}: </span>
        {repeat.rule}
      </span>
      {repeat.rotation && (
        <span className="inline-flex items-center gap-0.75">
          <ArrowsRightLeftIcon aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="sr-only">{taskCopy.rotationSr}</span>
          {repeat.rotation}
        </span>
      )}
    </>
  );
}
