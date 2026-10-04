import type { AvatarColor } from "./UserProfile";

/** First day of the week: 1 = Monday (default), 0 = Sunday (HH-07). */
export type WeekStart = 0 | 1;

/** households/{hid}: owned by its members, readable only by them. */
export interface Household {
  id: string;
  /** 1–50 characters, e.g. «Musterstrasse 12». */
  name: string;
  ownerId: string;
  memberIds: string[];
  weekStartsOn: WeekStart;
  /** IANA id, one of TIME_ZONES. */
  timeZone: string;
  /** Current invite code, format ABC-1234. */
  inviteCode: string;
  /** Server time the code was created; it expires 7 days later (HH-03). */
  inviteCreatedAt: Date;
  /**
   * Default order of new rotations (HH-07, Phase 4 B11); may hold former members, who are
   * skipped. Missing until the owner sets it.
   */
  rotationOrder?: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** Settings only the owner may change (HH-07). */
export type HouseholdSettingsUpdate = Partial<
  Pick<Household, "name" | "weekStartsOn" | "timeZone" | "rotationOrder">
>;

export type MemberRole = "owner" | "member";

/** households/{hid}/members/{uid}: the member's profile, copied for display. */
export interface Member {
  uid: string;
  displayName: string;
  initials: string;
  avatarColor: AvatarColor;
  role: MemberRole;
  joinedAt: Date;
  /** Joiners only: the code they joined with (checked by the join rule). */
  joinedWithCode?: string;
}

/** Fields a member may change on their own profile (HH-05). */
export interface MyProfileUpdate {
  displayName?: string;
  avatarColor?: AvatarColor;
}

/**
 * invites/{code}: lookup for the join flow. Carries a preview of the household for
 * «Code gefunden», since someone who isn't a member yet can't read the household.
 */
export interface Invite {
  code: string;
  householdId: string;
  householdName: string;
  ownerName: string;
  memberCount: number;
  createdBy: string;
  /** Server time; the code expires 7 days later. */
  createdAt: Date;
}
