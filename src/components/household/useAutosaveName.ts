import { useState, type ChangeEvent, type KeyboardEvent } from "react";
import { validateHouseholdName } from "../../domain/household";
import { householdCopy } from "../../lib/copy";
import { firestoreErrorMessage } from "../../lib/firestoreErrors";

/**
 * Autosave for a name field (B1): saves on blur or Enter when the trimmed value is valid
 * (1–50 characters) and changed; otherwise shows the field error and saves nothing. A failed
 * write shows its error on the field. While not editing, the field follows `value` live.
 */
export function useAutosaveName(value: string, save: (name: string) => Promise<void>) {
  // What the user is typing (null = not editing).
  const [draft, setDraft] = useState<string | null>(null);
  // A saved value until the write is done, so the field doesn't flash the old one.
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function commit() {
    if (draft === null) return;
    const result = validateHouseholdName(draft);
    if (!result.ok) {
      setError(result.error === "empty" ? householdCopy.nameEmpty : householdCopy.nameTooLong);
      return;
    }
    setError(null);
    setDraft(null);
    if (result.name === value) return;
    setSaving(result.name);
    try {
      await save(result.name);
    } catch (saveError) {
      setError(firestoreErrorMessage(saveError));
    } finally {
      setSaving(null);
    }
  }

  return {
    value: draft ?? saving ?? value,
    error: error ?? undefined,
    onChange: (event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value),
    onBlur: () => void commit(),
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void commit();
      }
    },
  };
}
