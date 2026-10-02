import { useEffect } from "react";

/** Sets the tab title to «<title> – Household» (just «Household» without a title). */
export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} – Household` : "Household";
  }, [title]);
}
