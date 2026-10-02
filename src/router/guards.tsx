import { Suspense, type ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { HouseholdLoadError } from "../components/household/HouseholdLoadError";
import { AppLayout } from "../components/layout/AppLayout";
import { AppStartScreen } from "../components/layout/AppStartScreen";
import { useAuth } from "../lib/auth/useAuth";
import { HouseholdProvider } from "../lib/household/HouseholdProvider";
import { useHousehold } from "../lib/household/useHousehold";
import NotFoundPage from "../pages/NotFoundPage";

/** Where a redirected visitor wanted to go (`state.from`), set by ProtectedRoute. */
interface RedirectState {
  from?: string;
}

/** App start screen until Firebase has restored the session (never flashes pages). */
export function AuthReady() {
  const { initializing } = useAuth();
  if (initializing) return <AppStartScreen />;
  return (
    <Suspense fallback={<AppStartScreen />}>
      <Outlet />
    </Suspense>
  );
}

/** Signed in (AUTH-03); otherwise → /login with state.from. */
export function ProtectedRoute() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from } satisfies RedirectState} />;
  }
  return <Outlet />;
}

/**
 * Household member (AUTH-06), inside ProtectedRoute: without a household → /onboarding.
 * Decides on the server-confirmed household id only, so a pending create or join keeps the
 * onboarding page mounted, and a pending profile edit keeps the shell (Phase 2 §2.6).
 * Mounts the HouseholdProvider (one per household) and the shell once the household has
 * loaded; App-Start while loading (D7), the error state inside the shell (D8).
 */
export function MemberRoute({ children }: { children?: ReactNode }) {
  const { user, profile, confirmedHouseholdId } = useAuth();
  if (!user || !profile || confirmedHouseholdId === undefined) return <AppStartScreen />;
  if (confirmedHouseholdId === null) return <Navigate to="/onboarding" replace />;
  return (
    <HouseholdProvider key={confirmedHouseholdId} householdId={confirmedHouseholdId} uid={user.uid}>
      <HouseholdShell>{children}</HouseholdShell>
    </HouseholdProvider>
  );
}

function HouseholdShell({ children }: { children?: ReactNode }) {
  const { loading, error } = useHousehold();
  if (error) {
    return (
      <AppLayout>
        <HouseholdLoadError />
      </AppLayout>
    );
  }
  if (loading) return <AppStartScreen />;
  return <AppLayout>{children}</AppLayout>;
}

/** Onboarding: only without a (confirmed) household; members go to /dashboard. */
export function NoHouseholdRoute() {
  const { profile, confirmedHouseholdId } = useAuth();
  if (!profile || confirmedHouseholdId === undefined) return <AppStartScreen />;
  if (confirmedHouseholdId !== null) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** /login: signed-in users go back to where they came from (or /dashboard). */
export function PublicOnlyRoute() {
  const { user } = useAuth();
  const location = useLocation();
  if (user) {
    const from = (location.state as RedirectState | null)?.from;
    const target = from && from !== "/login" ? from : "/dashboard";
    return <Navigate to={target} replace />;
  }
  return <Outlet />;
}

/**
 * 404 inside the shell for members (users without a household go to /onboarding first),
 * on its own when signed out.
 */
export function NotFoundRoute(): ReactNode {
  const { user } = useAuth();
  if (user) {
    return (
      <MemberRoute>
        <NotFoundPage />
      </MemberRoute>
    );
  }
  return <NotFoundPage standalone />;
}
