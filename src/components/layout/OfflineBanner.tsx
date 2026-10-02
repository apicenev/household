import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { offlineMessage } from "../../lib/copy";
import { InlineAlert } from "../ui/InlineAlert";

/** «Keine Verbindung – …» while the browser is offline (UI-16); renders nothing online. */
export function OfflineBanner({ className }: { className?: string }) {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <InlineAlert tone="warning" title={offlineMessage.title} className={className}>
      {offlineMessage.text}
    </InlineAlert>
  );
}
