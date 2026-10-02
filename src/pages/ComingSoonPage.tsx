import { ComingSoon } from "../components/layout/ComingSoon";
import { navItems, type AreaKey } from "../components/layout/navigation";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

/** «Bald verfügbar» inside the shell for areas that aren't built yet. */
export default function ComingSoonPage({ area }: { area: AreaKey }) {
  const item = navItems[area];
  useDocumentTitle(item.label);
  return <ComingSoon title={item.label} icon={item.icon} className="flex-1 py-16" />;
}
