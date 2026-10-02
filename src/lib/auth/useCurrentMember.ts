import { avatarColorFor, initialsFor } from "../../domain/member";
import type { AvatarColor } from "../../types";
import { useAuth } from "./useAuth";

export interface CurrentMember {
  name: string;
  email: string;
  initials: string;
  avatarColor: AvatarColor;
}

/**
 * Name, initials and avatar colour of the signed-in user for the shell. Falls back to
 * values derived from the email while the profile is still loading.
 */
export function useCurrentMember(): CurrentMember {
  const { user, profile } = useAuth();
  const email = user?.email ?? "";
  const fallbackName = email.split("@")[0] ?? "";
  return {
    name: profile?.displayName ?? fallbackName,
    email,
    initials: profile?.initials ?? initialsFor(fallbackName),
    avatarColor: profile?.avatarColor ?? avatarColorFor(user?.uid ?? ""),
  };
}
