import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
} from "@heroicons/react/16/solid";
import { HomeIcon } from "@heroicons/react/24/outline";
import { useEffect, useId, useState } from "react";
import { OnboardingStep } from "../../components/onboarding/OnboardingStep";
import { Button } from "../../components/ui/Button";
import { InlineAlert } from "../../components/ui/InlineAlert";
import { Field } from "../../components/ui/Field";
import { isInviteExpired, isValidInviteCodeFormat, normalizeInviteCode } from "../../domain/invite";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { useAuth } from "../../lib/auth/useAuth";
import { actions, householdCopy, loadingLabels, memberCountLabel } from "../../lib/copy";
import { cx } from "../../lib/cx";
import { firestoreErrorMessage, isOfflineError } from "../../lib/firestoreErrors";
import { getInvite, joinHousehold, JoinError } from "../../services/inviteService";
import type { Invite } from "../../types";

/** Wait after the last keystroke before looking a complete code up. */
const LOOKUP_DELAY_MS = 300;

type LookupResult =
  | { status: "found"; invite: Invite }
  | { status: "not-found" }
  | { status: "expired" }
  | { status: "error"; error: unknown };

type LookupState = { status: "idle" } | LookupResult;

/**
 * /onboarding/join «Mit Code beitreten» (HH-02). The code is normalised while typing and
 * looked up once complete. Hint states: format (info) → «gibt es nicht» / «abgelaufen» (D2,
 * danger) → «Code gefunden» (success) with the household card. «Beitreten» only when found.
 * Offline, the lookup and «Beitreten» wait (D11).
 */
export default function JoinHouseholdPage() {
  const { profile } = useAuth();
  const online = useOnlineStatus();
  const [code, setCode] = useState("");
  // Lookup results by code; the current state is derived from the code being shown.
  const [result, setResult] = useState<{ code: string; result: LookupResult } | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<unknown>(null);
  const inputId = useId();
  const hintId = useId();
  useDocumentTitle("Mit Code beitreten");

  const complete = isValidInviteCodeFormat(code);
  const lookup: LookupState =
    complete && result?.code === code ? result.result : { status: "idle" };

  useEffect(() => {
    if (!complete || !online || result?.code === code) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      getInvite(code).then(
        (invite) => {
          if (cancelled) return;
          const next: LookupResult = !invite
            ? { status: "not-found" }
            : isInviteExpired(invite.createdAt)
              ? { status: "expired" }
              : { status: "found", invite };
          setResult({ code, result: next });
        },
        (error: unknown) => {
          if (!cancelled) setResult({ code, result: { status: "error", error } });
        },
      );
    }, LOOKUP_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, complete, online, result]);

  async function join() {
    if (lookup.status !== "found" || !profile || !online || joining) return;
    setJoinError(null);
    setJoining(true);
    try {
      await joinHousehold(lookup.invite, profile);
      // No navigate: the guard redirects once the server has confirmed the membership.
    } catch (error) {
      setJoining(false);
      if (
        error instanceof JoinError &&
        (error.reason === "not-found" || error.reason === "expired")
      ) {
        setResult({ code, result: { status: error.reason } });
      } else {
        setJoinError(error);
      }
    }
  }

  const lookupError = lookup.status === "error" ? lookup.error : null;
  const shownError = joinError ?? lookupError;
  const hint = hintFor(lookup);

  return (
    <OnboardingStep
      title="Mit Code beitreten"
      lead="Den Code findet dein Mitbewohner unter Haushalt → Einladen."
      onSubmit={() => void join()}
      footer={
        <Button
          type="submit"
          size="lg"
          fullWidth
          disabled={lookup.status !== "found" || !online}
          loading={joining}
          loadingLabel={loadingLabels.joining}
        >
          Beitreten
        </Button>
      }
    >
      {shownError !== null && (
        <InlineAlert
          tone="danger"
          // A failed lookup is kept for its code; this looks it up again.
          action={
            joinError === null
              ? { label: actions.retry, onClick: () => setResult(null) }
              : undefined
          }
        >
          {isOfflineError(shownError) ||
          (shownError instanceof JoinError && shownError.reason === "offline")
            ? firestoreErrorMessage({ code: "unavailable" })
            : "Das hat nicht geklappt. Versuch es nochmals."}
        </InlineAlert>
      )}
      <Field label="Einladungscode" htmlFor={inputId} helperId={hintId} errorId={hintId}>
        <input
          id={inputId}
          name="inviteCode"
          value={code}
          onChange={(event) => {
            setCode(normalizeInviteCode(event.target.value));
            setJoinError(null);
          }}
          placeholder="ABC-1234"
          maxLength={8}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          disabled={joining}
          aria-invalid={hint.tone === "danger" || undefined}
          aria-describedby={hintId}
          className={cx(
            "h-15 w-full rounded-control bg-surface px-4 text-center font-mono text-[26px] font-semibold tracking-[0.14em] text-ink uppercase transition-[border-color,box-shadow] duration-(--duration-fast) outline-none placeholder:text-ink-subtle focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-subtle",
            hint.tone === "success"
              ? "border-[1.5px] border-success"
              : hint.tone === "danger"
                ? "border-[1.5px] border-danger focus:ring-3 focus:ring-danger-soft"
                : "border border-control focus:border-brand focus:ring-3 focus:ring-brand-soft hovered:border-ink-muted",
          )}
        />
        <span
          id={hintId}
          aria-live="polite"
          className={cx(
            "flex items-center gap-1.5 text-[13px] leading-[18px] font-medium",
            hint.tone === "success" && "text-success",
            hint.tone === "danger" && "text-danger",
            hint.tone === "info" && "text-ink-muted",
          )}
        >
          <hint.icon aria-hidden="true" className="size-4 shrink-0" />
          {hint.text}
        </span>
      </Field>
      {lookup.status === "found" && (
        <div className="flex items-center gap-3 rounded-card bg-surface px-4 py-3.5 shadow-card">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-brand-soft text-brand"
          >
            <HomeIcon className="size-6" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-body font-semibold text-ink">
              {lookup.invite.householdName}
            </span>
            <span className="text-[13px] leading-[18px] text-ink-muted">
              {lookup.invite.ownerName} · {memberCountLabel(lookup.invite.memberCount)}
            </span>
          </span>
        </div>
      )}
    </OnboardingStep>
  );
}

function hintFor(lookup: LookupState) {
  switch (lookup.status) {
    case "found":
      return { tone: "success", icon: CheckCircleIcon, text: householdCopy.codeFound } as const;
    case "not-found":
      return {
        tone: "danger",
        icon: ExclamationCircleIcon,
        text: householdCopy.codeNotFound,
      } as const;
    case "expired":
      return {
        tone: "danger",
        icon: ExclamationCircleIcon,
        text: householdCopy.codeExpired,
      } as const;
    default:
      return {
        tone: "info",
        icon: InformationCircleIcon,
        text: householdCopy.codeFormatHint,
      } as const;
  }
}
