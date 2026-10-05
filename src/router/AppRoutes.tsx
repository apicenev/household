import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import {
  AuthReady,
  MemberRoute,
  NoHouseholdRoute,
  NotFoundRoute,
  ProtectedRoute,
  PublicOnlyRoute,
} from "./guards";

const LoginPage = lazy(() => import("../pages/LoginPage"));
const ActivityPage = lazy(() => import("../pages/ActivityPage"));
const DashboardPage = lazy(() => import("../pages/DashboardPage"));
const HouseholdPage = lazy(() => import("../pages/HouseholdPage"));
const TasksPage = lazy(() => import("../pages/TasksPage"));
const ShoppingPage = lazy(() => import("../pages/ShoppingPage"));
const CalendarPage = lazy(() => import("../pages/CalendarPage"));
const OnboardingChoicePage = lazy(() => import("../pages/onboarding/OnboardingChoicePage"));
const CreateHouseholdPage = lazy(() => import("../pages/onboarding/CreateHouseholdPage"));
const JoinHouseholdPage = lazy(() => import("../pages/onboarding/JoinHouseholdPage"));
// Dev-only primitives gallery; the DEV check lets the production build drop it.
const UiGalleryPage = import.meta.env.DEV ? lazy(() => import("../pages/dev/UiGalleryPage")) : null;

/** Route table (Phase 1 §1.9, Phase 2 §2.6, Phases 3, 5, 6 and 8). */
export function AppRoutes() {
  return (
    <Routes>
      {UiGalleryPage && <Route path="/dev/ui" element={<UiGalleryPage />} />}

      <Route element={<AuthReady />}>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          {/* Standalone (AuthLayout), no shell. */}
          <Route element={<NoHouseholdRoute />}>
            <Route path="/onboarding" element={<OnboardingChoicePage />} />
            <Route path="/onboarding/create" element={<CreateHouseholdPage />} />
            <Route path="/onboarding/join" element={<JoinHouseholdPage />} />
          </Route>
          {/* MemberRoute renders the shell around these. */}
          <Route element={<MemberRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/shopping" element={<ShoppingPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/household" element={<HouseholdPage />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundRoute />} />
      </Route>
    </Routes>
  );
}
