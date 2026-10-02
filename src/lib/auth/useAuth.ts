import { createContext, useContext } from "react";
import type { UserProfile } from "../../types";

export interface AuthUser {
  uid: string;
  email: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  /** users/{uid}; null until it is loaded (or created on the first login). */
  profile: UserProfile | null;
  /**
   * The profile's householdId as confirmed by the server (null = no household, undefined =
   * not known yet). Unlike `profile.householdId` it ignores a pending create or join, so the
   * guards only switch to the household once its batch has been accepted (Phase 2 §2.6).
   */
  confirmedHouseholdId: string | null | undefined;
  /** True until Firebase has restored the session. */
  initializing: boolean;
  /** Rejects with the Firebase error; map it with authErrorMessage(). */
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth() must be used inside <AuthProvider>.");
  return value;
}
