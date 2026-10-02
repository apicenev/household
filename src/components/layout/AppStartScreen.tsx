import { BrandTile } from "./BrandMark";
import { OfflineBanner } from "./OfflineBanner";

/**
 * App start (derived screen, Phase 1 §1.1): brand tile above «Household» on canvas.
 * No spinner; it only fades in after 300 ms, so fast starts show nothing. Shows the offline
 * banner if the start takes longer without connection.
 */
export function AppStartScreen() {
  return (
    <main
      aria-busy="true"
      className="relative flex min-h-dvh animate-delayed-fade-in flex-col items-center justify-center gap-4 bg-canvas px-4"
    >
      <OfflineBanner className="absolute inset-x-4 top-[calc(env(safe-area-inset-top)+--spacing(4))] mx-auto max-w-120" />
      <BrandTile size={56} />
      <h1 className="font-display text-title text-ink">Household</h1>
    </main>
  );
}
