/** Member avatar colour: index into the avatar-1 … avatar-8 tokens. */
export type AvatarColor = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** users/{uid}: created on the first login (AUTH-05). */
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  /** One or two letters, e.g. «NA». */
  initials: string;
  avatarColor: AvatarColor;
  /** Set when the user joins or creates a household (Phase 2). */
  householdId?: string;
  createdAt: Date;
}

/** Fields a user may change on their own profile. */
export type UserProfileUpdate = Partial<
  Pick<UserProfile, "displayName" | "initials" | "avatarColor">
>;
