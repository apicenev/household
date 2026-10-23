import { BrowserRouter, useLocation } from "react-router-dom";
import { ErrorBoundary } from "./components/layout/ErrorBoundary";
import { ToastProvider } from "./components/ui/ToastProvider";
import { AppRoutes } from "./router/AppRoutes";

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <RoutesWithBoundary />
      </ToastProvider>
    </BrowserRouter>
  );
}

/** The last-resort boundary (Phase 9 B15, D97), reset by navigating elsewhere. */
function RoutesWithBoundary() {
  const location = useLocation();
  return (
    <ErrorBoundary resetKey={location.pathname} standalone>
      <AppRoutes />
    </ErrorBoundary>
  );
}
