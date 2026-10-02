import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ensureUserProfile, listenToUserProfile } from "../../services/userService";
import type { UserProfile } from "../../types";
import { auth } from "../firebase";
import { AuthContext, type AuthContextValue, type AuthUser } from "./useAuth";

interface AuthState {
  user: AuthUser | null;
  profile: UserProfile | null;
  initializing: boolean;
}

const signedOut: AuthState = { user: null, profile: null, initializing: false };

/** Firestore couldn't reach the backend (e.g. the app was opened without connection). */
function isOffline(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "unavailable"
  );
}

/**
 * Auth state (AUTH-02, AUTH-05). Accounts exist only if the admin created them in the
 * Firebase console (self sign-up is disabled there), so every signed-in user has access.
 *
 * After Firebase reports a user, the profile users/{uid} is created on the first login and
 * then listened to. `initializing` stays true until Firebase has restored the session, so
 * protected pages never flash.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ...signedOut, initializing: true });
  // Incremented on every auth change; async results from an older run are dropped.
  const run = useRef(0);
  const cleanups = useRef<Array<() => void>>([]);

  const stopListeners = useCallback(() => {
    for (const cleanup of cleanups.current) cleanup();
    cleanups.current = [];
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      run.current += 1;
      const generation = run.current;
      stopListeners();

      if (!firebaseUser) {
        setState(signedOut);
        return;
      }

      const user: AuthUser = { uid: firebaseUser.uid, email: firebaseUser.email ?? "" };
      setState({ user, profile: null, initializing: false });

      // Not awaited: when offline, the write is queued and only resolves once synced.
      ensureUserProfile(user, firebaseUser.displayName ?? "").catch((error: unknown) => {
        if (!isOffline(error)) console.error("Profil konnte nicht erstellt werden", error);
      });
      const unsubscribeProfile = listenToUserProfile(
        user.uid,
        (profile) => {
          if (generation === run.current) setState((current) => ({ ...current, profile }));
        },
        (error) => console.error("Profil konnte nicht geladen werden", error),
      );
      cleanups.current.push(unsubscribeProfile);
    });

    return () => {
      unsubscribe();
      stopListeners();
    };
  }, [stopListeners]);

  const login = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const logout = useCallback(async () => {
    run.current += 1;
    stopListeners();
    setState((current) => ({ ...current, profile: null }));
    await signOut(auth);
  }, [stopListeners]);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout }),
    [state, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
