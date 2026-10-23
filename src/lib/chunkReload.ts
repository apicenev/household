/** How long a chunk reload counts as «just tried» (no reload loop). */
const RELOAD_WINDOW_MS = 10_000;
const RELOAD_KEY = "household:chunk-reload";

/** A lazy page that couldn't load, typically an old chunk after a deploy (Phase 9 B15). */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(
    message,
  );
}

/**
 * Reloads the page, at most once per 10 s; false if it just did (or can't tell, without
 * storage), so the caller shows its error instead of looping.
 */
export function reloadOnce(reload: () => void = () => window.location.reload()): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  reload();
  return true;
}
