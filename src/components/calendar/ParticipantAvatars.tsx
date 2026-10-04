import { visibleParticipants } from "../../domain/calendar";
import { calendarCopy } from "../../lib/copy";
import { cx } from "../../lib/cx";
import type { EventParticipants, Member } from "../../types";
import { Avatar } from "../ui/Avatar";
import { participantNames } from "./calendarLabels";

/** Avatars shown before «+n» (B5). */
const MAX_SHOWN = 3;

/**
 * Who an event is for (CAL-08, B5), as in `Calendar.dc.html`: stacked avatars overlapping by
 * 7 px with a 2 px surface ring; «Alle» shows every current member. Read as «Für: Alle» /
 * «Für: Anna».
 */
export function ParticipantAvatars({
  participants,
  members,
  size = 26,
  className,
}: {
  participants: EventParticipants;
  members: readonly Member[];
  /** 26 (cards), 24 (desktop «Demnächst»), 30 (Termin-Detail). */
  size?: 24 | 26 | 30;
  className?: string;
}) {
  const { members: shown } = visibleParticipants(participants, members);
  if (shown.length === 0) return null;
  const visible = shown.slice(0, MAX_SHOWN);
  const hidden = shown.length - visible.length;
  return (
    <span
      role="img"
      aria-label={`${calendarCopy.participants}: ${participantNames(participants, members)}`}
      className={cx("inline-flex shrink-0 items-center", className)}
    >
      {visible.map((member, index) => (
        <Avatar
          key={member.uid}
          initials={member.initials}
          color={member.avatarColor}
          size={size}
          className={cx("ring-2 ring-surface", index > 0 && "-ml-1.75")}
        />
      ))}
      {hidden > 0 && (
        <span
          aria-hidden="true"
          className={cx(
            "-ml-1.75 inline-flex shrink-0 items-center justify-center rounded-pill bg-sunken text-[10px] font-[650] text-ink-muted ring-2 ring-surface",
            size === 24 ? "size-6" : size === 26 ? "size-6.5" : "size-7.5",
          )}
        >
          +{hidden}
        </span>
      )}
    </span>
  );
}
