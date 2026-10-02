import { useId, useRef, useState } from "react";
import { OnboardingStep } from "../../components/onboarding/OnboardingStep";
import { Button } from "../../components/ui/Button";
import { InlineAlert } from "../../components/ui/InlineAlert";
import { TextField } from "../../components/ui/TextField";
import { MAX_HOUSEHOLD_NAME, validateHouseholdName } from "../../domain/household";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { useAuth } from "../../lib/auth/useAuth";
import { householdCopy } from "../../lib/copy";
import { firestoreErrorMessage, isOfflineError } from "../../lib/firestoreErrors";
import { createHousehold } from "../../services/householdService";

/** Name suggestions (B5); the design's «Musterstrasse 12» is example data. */
const suggestions = ["Zuhause", "WG Linde", "Unsere Wohnung"];

/**
 * /onboarding/create «Haushalt erstellen» (HH-01). Stays in its loading state until the
 * server has accepted the batch; then NoHouseholdRoute moves on to /dashboard (B8). If the
 * batch is rejected, the error shows with the name still there.
 */
export default function CreateHouseholdPage() {
  const { profile } = useAuth();
  const online = useOnlineStatus();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsId = useId();
  useDocumentTitle("Haushalt erstellen");

  const validation = validateHouseholdName(name);

  async function submit() {
    if (!validation.ok) return inputRef.current?.focus();
    if (!profile || !online || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await createHousehold(profile, validation.name);
      // No navigate: the guard redirects once the server has confirmed the household.
    } catch (createError) {
      setError(createError);
      setSubmitting(false);
    }
  }

  return (
    <OnboardingStep
      title="Haushalt erstellen"
      lead="Gib eurem Zuhause einen Namen. Du kannst ihn später ändern."
      onSubmit={() => void submit()}
      footer={
        <Button
          type="submit"
          size="lg"
          fullWidth
          disabled={!validation.ok || !online}
          loading={submitting}
          loadingLabel={householdCopy.creating}
        >
          Haushalt erstellen
        </Button>
      }
    >
      {error !== null && (
        <InlineAlert tone="danger">
          {isOfflineError(error)
            ? firestoreErrorMessage(error)
            : "Das hat nicht geklappt. Versuch es nochmals."}
        </InlineAlert>
      )}
      <TextField
        ref={inputRef}
        label="Name des Haushalts"
        helper="Zum Beispiel eure Adresse oder «WG Linde»."
        name="householdName"
        autoComplete="off"
        maxLength={MAX_HOUSEHOLD_NAME}
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={submitting}
      />
      <div className="flex flex-col gap-2">
        <span id={suggestionsId} className="text-body-sm font-semibold text-ink">
          Vorschläge
        </span>
        <div role="group" aria-labelledby={suggestionsId} className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={submitting}
              onClick={() => setName(suggestion)}
              className="h-10 cursor-pointer rounded-pill bg-surface px-3.5 text-[15px] text-ink inset-ring inset-ring-line-strong transition-colors duration-(--duration-fast) disabled:cursor-not-allowed disabled:text-ink-subtle hovered:bg-sunken"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </OnboardingStep>
  );
}
