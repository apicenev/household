import { createContext, useContext } from "react";

/** The three parts of the Schnellerfassung. */
export type QuickAddEntry = "task" | "item" | "event";

export interface QuickAddContextValue {
  /** Opens the Schnellerfassung, on `entry` if given (Phase 8 B7); otherwise where it was. */
  open: (entry?: QuickAddEntry) => void;
}

export const QuickAddContext = createContext<QuickAddContextValue | null>(null);

/** The Schnellerfassung of the shell. Needs <AppLayout>. */
export function useQuickAdd(): QuickAddContextValue {
  const value = useContext(QuickAddContext);
  if (!value) throw new Error("useQuickAdd() must be used inside <AppLayout>.");
  return value;
}
