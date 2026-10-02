import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { useAuth } from "../../lib/auth/useAuth";
import { actions } from "../../lib/copy";
import { useHousehold } from "../../lib/household/useHousehold";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";

/** D8: the household listeners failed (e.g. no connection, or no longer a member). */
export function HouseholdLoadError() {
  const { retry } = useHousehold();
  const { logout } = useAuth();
  const navigate = useNavigate();
  useDocumentTitle("Haushalt konnte nicht geladen werden");

  return (
    <div className="flex flex-1 items-center justify-center py-8">
      <EmptyState
        as="h1"
        icon={ExclamationTriangleIcon}
        title="Haushalt konnte nicht geladen werden"
        text="Prüf deine Verbindung und versuch es nochmals."
        className="w-full max-w-100"
        action={
          <div className="flex flex-col items-center gap-2">
            <Button size="compact" onClick={retry}>
              Erneut versuchen
            </Button>
            <Button
              size="compact"
              variant="secondary"
              onClick={() => void logout().then(() => navigate("/login", { replace: true }))}
            >
              {actions.logout}
            </Button>
          </div>
        }
      />
    </div>
  );
}
