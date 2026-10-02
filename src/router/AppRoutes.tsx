import { HomeModernIcon } from "@heroicons/react/24/outline";
import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { ComingSoon } from "../components/layout/ComingSoon";
import ComingSoonPage from "../pages/ComingSoonPage";
import { AuthReady, MemberRoute, NotFoundRoute, ProtectedRoute, PublicOnlyRoute } from "./guards";

const LoginPage = lazy(() => import("../pages/LoginPage"));
// Dev-only primitives gallery; the DEV check lets the production build drop it.
const UiGalleryPage = import.meta.env.DEV ? lazy(() => import("../pages/dev/UiGalleryPage")) : null;

/** Route table (Phase 1 §1.9). */
export function AppRoutes() {
  return (
    <Routes>
      {UiGalleryPage && <Route path="/dev/ui" element={<UiGalleryPage />} />}

      <Route element={<AuthReady />}>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            {/* Household setup arrives in Phase 2. */}
            <Route
              path="/onboarding"
              element={
                <ComingSoon
                  title="Haushalt einrichten"
                  icon={HomeModernIcon}
                  className="flex-1 py-16"
                />
              }
            />
            <Route element={<MemberRoute />}>
              <Route path="/dashboard" element={<ComingSoonPage area="dashboard" />} />
              <Route path="/tasks" element={<ComingSoonPage area="tasks" />} />
              <Route path="/shopping" element={<ComingSoonPage area="shopping" />} />
              <Route path="/calendar" element={<ComingSoonPage area="calendar" />} />
              <Route path="/activity" element={<ComingSoonPage area="activity" />} />
              <Route path="/household" element={<ComingSoonPage area="household" />} />
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundRoute />} />
      </Route>
    </Routes>
  );
}
