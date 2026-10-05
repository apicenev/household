import { useMemo, useState, type ReactNode } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { openItemCount } from "../../domain/shopping";
import { shoppingCopy } from "../../lib/copy";
import { cx } from "../../lib/cx";
import { useHousehold } from "../../lib/household/useHousehold";
import { OfflineBanner } from "./OfflineBanner";
import { QuickAddSheet } from "./QuickAddSheet";
import { QuickAddContext, type QuickAddEntry } from "./quickAddContext";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { TopBar } from "./TopBar";
import { areaForPath } from "./navigation";

/**
 * Signed-in shell. Below lg: top bar + content + tab bar. From lg: 272 px sidebar + content
 * column (max 1080 px). Hosts the offline banner and the Schnellerfassung (also opened from
 * pages through `useQuickAdd`, Phase 8 B7).
 * Haushalt (reached from the account menu) has a back button and no tab bar on phones, as in
 * `Household.dc.html`. The Termin-Detail (`/calendar?event=…`, Phase 6 D45) brings its own
 * header and has no tab bar either; on desktop the calendar turns `?event=` into a selection.
 * Aktivität has the back button too, but keeps the tab bar (`Activity.dc.html`, Phase 8 D76).
 */
export function AppLayout({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddEntry, setQuickAddEntry] = useState<QuickAddEntry | undefined>();
  const quickAdd = useMemo(
    () => ({
      open: (entry?: QuickAddEntry) => {
        setQuickAddEntry(entry);
        setQuickAddOpen(true);
      },
    }),
    [],
  );
  const area = areaForPath(location.pathname);
  // Start shows the brand in the mobile header (Dashboard.dc.html); other areas their name.
  const title = area && area.key !== "dashboard" ? area.label : undefined;
  const eventDetail = area?.key === "calendar" && new URLSearchParams(location.search).has("event");
  const pushed = area?.key === "household" || eventDetail;
  const backButton = pushed || area?.key === "activity";
  const { household, items, itemsLoading, itemsError } = useHousehold();
  // Einkauf: «4 offen» / «Alles erledigt» next to the title (B13).
  const subtitle =
    area?.key === "shopping" && household && !itemsLoading && !itemsError
      ? shoppingCopy.openCount(openItemCount(items))
      : undefined;

  // B12: back to the previous page if there is in-app history, otherwise to Start.
  function goBack() {
    if (location.key !== "default") navigate(-1);
    else navigate("/dashboard");
  }

  return (
    <QuickAddContext.Provider value={quickAdd}>
      <div className="min-h-dvh bg-canvas text-ink lg:flex">
        <Sidebar onQuickAdd={() => quickAdd.open()} className="hidden lg:flex" />
        <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
          {eventDetail ? null : backButton && area ? (
            <TopBar variant="back" title={area.label} onBack={goBack} className="lg:hidden" />
          ) : (
            <TopBar title={title} subtitle={subtitle} className="lg:hidden" />
          )}
          <main
            className={cx(
              "flex flex-1 flex-col px-4 pt-2 lg:px-12 lg:pt-10 lg:pb-12",
              // The Termin-Detail ends in its own action bar at the screen edge.
              eventDetail
                ? "pb-0"
                : pushed
                  ? "pb-[calc(env(safe-area-inset-bottom)+--spacing(12))]"
                  : "pb-[calc(var(--tabbar-height)+env(safe-area-inset-bottom)+--spacing(6))]",
            )}
          >
            <div className="mx-auto flex w-full max-w-270 flex-1 flex-col gap-6">
              <OfflineBanner />
              {children ?? <Outlet />}
            </div>
          </main>
        </div>
        {!pushed && <TabBar onQuickAdd={() => quickAdd.open()} className="lg:hidden" />}
        <QuickAddSheet
          open={quickAddOpen}
          onClose={() => setQuickAddOpen(false)}
          initialEntry={quickAddEntry}
        />
      </div>
    </QuickAddContext.Provider>
  );
}
