import { UserPlusIcon } from "@heroicons/react/20/solid";
import { cx } from "../../lib/cx";
import type { AvatarColor } from "../../types";

export type { AvatarColor };

/**
 * Diameter in px. The sheet names sm 24 / md 32 / lg 48 / xl 72; 28 (rows, chips, selects),
 * 34 (top bar), 36 (menu, sidebar, activity), 40 (member rows), 56 (onboarding, desktop
 * profile) and 64 (mobile profile) are used by the screens.
 */
export type AvatarSize = 24 | 28 | 32 | 34 | 36 | 40 | 48 | 56 | 64 | 72;

/** sans: initials in the UI font · display: Newsreader (profile avatars). */
export type AvatarTypeface = "sans" | "display";

const colors: Record<AvatarColor, string> = {
  1: "bg-avatar-1 text-avatar-1-ink",
  2: "bg-avatar-2 text-avatar-2-ink",
  3: "bg-avatar-3 text-avatar-3-ink",
  4: "bg-avatar-4 text-avatar-4-ink",
  5: "bg-avatar-5 text-avatar-5-ink",
  6: "bg-avatar-6 text-avatar-6-ink",
  7: "bg-avatar-7 text-avatar-7-ink",
  8: "bg-avatar-8 text-avatar-8-ink",
};

const sizes: Record<AvatarSize, string> = {
  24: "size-6 text-[10px] font-[650]",
  28: "size-7 text-[11px] font-[650]",
  32: "size-8 text-caption font-[650]",
  34: "size-8.5 text-[13px] font-[650]",
  36: "size-9 text-[13px] font-[650] tracking-[0.02em]",
  40: "size-10 text-[14px] font-[650]",
  48: "size-12 text-[17px] font-[650]",
  56: "size-14 text-[20px] font-[650]",
  64: "size-16 font-display text-[24px] font-semibold",
  72: "size-18 font-display text-[26px] font-semibold",
};

/** Sizes that exist in both typefaces (56: sans on onboarding, display in the profile). */
const displaySizes: Partial<Record<AvatarSize, string>> = {
  56: "size-14 font-display text-[21px] font-semibold",
};

export interface AvatarProps {
  initials: string;
  color: AvatarColor;
  size?: AvatarSize;
  /** Only changes sizes designed in both typefaces (56); the others have a fixed one. */
  typeface?: AvatarTypeface;
  /** Accessible name (the member's name). Omit when the name is shown next to the avatar. */
  name?: string;
  className?: string;
}

/** Initials on the member's avatar colour. */
export function Avatar({
  initials,
  color,
  size = 32,
  typeface = "sans",
  name,
  className,
}: AvatarProps) {
  return (
    <span
      role={name ? "img" : undefined}
      aria-label={name}
      aria-hidden={name ? undefined : true}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-pill leading-none select-none",
        colors[color],
        (typeface === "display" && displaySizes[size]) || sizes[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}

/** Dashed placeholder for «Mitglied einladen» (48 px). */
export function AvatarInvite({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex size-12 shrink-0 items-center justify-center rounded-pill border-[1.5px] border-dashed border-control text-ink-muted",
        className,
      )}
    >
      <UserPlusIcon className="size-5" />
    </span>
  );
}

export interface AvatarGroupMember {
  id: string;
  name: string;
  initials: string;
  color: AvatarColor;
}

export interface AvatarGroupProps {
  members: AvatarGroupMember[];
  /** Avatars shown before «+N» (default 3). */
  max?: number;
  size?: 28 | 32;
  /** Text after the stack, e.g. «Alle». */
  label?: string;
  className?: string;
}

/** Overlapping avatars (−8 px) with a 2 px surface ring and a «+N» overflow. */
export function AvatarGroup({ members, max = 3, size = 32, label, className }: AvatarGroupProps) {
  const shown = members.slice(0, max);
  const hidden = members.length - shown.length;
  const names = members.map((member) => member.name).join(", ");

  return (
    <span
      role="img"
      aria-label={label ? `${label}: ${names}` : names}
      className={cx("inline-flex items-center", className)}
    >
      {shown.map((member, index) => (
        <Avatar
          key={member.id}
          initials={member.initials}
          color={member.color}
          size={size}
          className={cx("ring-2 ring-surface", index > 0 && "-ml-2")}
        />
      ))}
      {hidden > 0 && (
        <span
          aria-hidden="true"
          className={cx(
            "-ml-2 inline-flex shrink-0 items-center justify-center rounded-pill bg-sunken font-[650] text-ink-muted ring-2 ring-surface",
            size === 32 ? "size-8 text-caption" : "size-7 text-[11px]",
          )}
        >
          +{hidden}
        </span>
      )}
      {label && (
        <span aria-hidden="true" className="ml-2 text-body-sm text-ink-muted">
          {label}
        </span>
      )}
    </span>
  );
}
