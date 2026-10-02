import { MapIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../components/ui/EmptyState";
import { Button } from "../components/ui/Button";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

/**
 * 404 (derived screen, Phase 1 §1.1): EmptyState with «Zur Startseite». Inside the shell
 * when signed in, centred on canvas otherwise.
 */
export default function NotFoundPage({ standalone = false }: { standalone?: boolean }) {
  const navigate = useNavigate();
  useDocumentTitle("Seite nicht gefunden");

  const content = (
    <EmptyState
      as="h1"
      icon={MapIcon}
      title="Seite nicht gefunden"
      text="Diese Seite gibt es nicht (mehr)."
      className="w-full max-w-100"
      action={<Button onClick={() => navigate("/dashboard")}>Zur Startseite</Button>}
    />
  );

  if (!standalone) {
    return <div className="flex flex-1 items-center justify-center py-8">{content}</div>;
  }
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      {content}
    </main>
  );
}
