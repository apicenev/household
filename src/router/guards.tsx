import { Suspense, type ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { AppStartScreen } from "../components/layout/AppStartScreen";
import { useAuth } from "../lib/auth/useAuth";
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
 * Household member. Stub until Phase 2: passes everyone through (household-less users are
 * sent to /onboarding from then on).
 */
export function MemberRoute() {
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

/** 404 inside the shell for members, on its own otherwise. */
export function NotFoundRoute(): ReactNode {
  const { user } = useAuth();
  if (user) {
    return (
      <AppLayout>
        <NotFoundPage />
      </AppLayout>
    );
  }
  return <NotFoundPage standalone />;
}
