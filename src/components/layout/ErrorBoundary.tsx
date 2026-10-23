import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useAuth } from "../../lib/auth/useAuth";
import { isChunkLoadError, reloadOnce } from "../../lib/chunkReload";
import { actions, crashCopy } from "../../lib/copy";
import { cx } from "../../lib/cx";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";

interface Props {
  children: ReactNode;
  /** Changes (e.g. the path) clear the error, so navigating away recovers. */
  resetKey?: string;
  /** Outside the shell: a full screen of its own. */
  standalone?: boolean;
}

/**
 * Catches render errors (Phase 9 B15) and shows D97 instead of a blank page: inside the shell
 * around the page content, and around all routes as the last resort. A failed lazy chunk
 * after a deploy reloads the page once by itself first. Errors go to the console only.
 */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isChunkLoadError(error) && reloadOnce()) return;
    console.error(error, info.componentStack);
  }

  componentDidUpdate(previous: Props) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) return <CrashScreen standalone={this.props.standalone} />;
    return this.props.children;
  }
}

/** D97: the D8 pattern with «Neu laden» and «Abmelden». */
function CrashScreen({ standalone = false }: { standalone?: boolean }) {
  const { user, logout } = useAuth();
  return (
    <div
      className={cx(
        "flex flex-1 items-center justify-center py-8",
        standalone && "min-h-dvh bg-canvas px-4",
      )}
    >
      <EmptyState
        as="h1"
        icon={ExclamationTriangleIcon}
        title={crashCopy.title}
        text={crashCopy.text}
        className="w-full max-w-100"
        action={
          <div className="flex flex-col items-center gap-2">
            <Button size="compact" onClick={() => window.location.reload()}>
              {crashCopy.reload}
            </Button>
            {user && (
              <Button
                size="compact"
                variant="secondary"
                onClick={() => void logout().then(() => window.location.assign("/login"))}
              >
                {actions.logout}
              </Button>
            )}
          </div>
        }
      />
    </div>
  );
}
