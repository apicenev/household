import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { CheckIcon, DocumentDuplicateIcon } from "@heroicons/react/20/solid";
import { UserPlusIcon } from "@heroicons/react/24/outline";
import { useEffect, useId, useRef, useState } from "react";
import { inviteExpiresAt, isInviteExpired } from "../../domain/invite";
import { useIsDesktop } from "../../hooks/useMediaQuery";
import { householdCopy } from "../../lib/copy";
import { cx } from "../../lib/cx";
import { formatDate } from "../../lib/format";
import type { Household } from "../../types";
import { Button } from "../ui/Button";

/** How long «Kopiert» stays before the button returns to «Code kopieren». */
const COPIED_MS = 1800;

/**
 * Einladungskarte (`Components` → InviteCard, `Household`), without a link (D10): the current
 * code with its expiry, «Code kopieren» for everyone, «Neuer Code» for the owner (HH-03, D3).
 * Expired (D4): muted code, «Abgelaufen am …», copy disabled; members are asked to get a new
 * code from the owner.
 */
export function InviteCard({
  household,
  isOwner,
  ownerName,
  onNewCode,
  regenerating = false,
}: {
  household: Household;
  isOwner: boolean;
  ownerName: string;
  onNewCode: () => void;
  regenerating?: boolean;
}) {
  const desktop = useIsDesktop();
  const titleId = useId();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const expired = isInviteExpired(household.inviteCreatedAt);
  const until = formatDate(inviteExpiresAt(household.inviteCreatedAt), household.timeZone);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(household.inviteCode);
    } catch {
      // No clipboard (permissions, old browser): the code on the card is selectable.
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  }

  return (
    <div className="flex flex-col gap-2">
      <section
        aria-labelledby={titleId}
        className="flex flex-col gap-3.5 rounded-card bg-surface p-4 shadow-card lg:p-5"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-brand-soft text-brand lg:size-11"
          >
            <UserPlusIcon className="size-6" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <h2 id={titleId} className="truncate text-body font-semibold text-ink lg:text-heading">
              {desktop ? `Zu ${household.name} einladen` : "Einladen"}
            </h2>
            <span className="text-[13px] leading-[18px] text-ink-muted">
              {desktop ? "Alle mit dem Code können beitreten" : "Mit Code beitreten"}
            </span>
          </span>
          {isOwner && (
            <Button
              variant="ghost"
              size="sm"
              icon={ArrowPathIcon}
              onClick={onNewCode}
              disabled={regenerating}
            >
              {householdCopy.newCode}
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-control border border-dashed border-line-strong bg-sunken px-3.5 py-3 lg:px-4 lg:py-3.5">
          <span
            className={cx(
              "font-mono text-[22px] font-semibold tracking-[0.12em] tabular-nums select-all lg:text-[26px]",
              expired ? "text-ink-subtle" : "text-ink",
            )}
          >
            {household.inviteCode}
          </span>
          <span
            className={cx(
              "text-right text-caption font-normal tabular-nums",
              expired ? "text-danger" : "text-ink-muted",
            )}
          >
            {expired ? `Abgelaufen am ${until}` : desktop ? `Gültig bis ${until}` : `bis ${until}`}
          </span>
        </div>

        <Button
          variant="secondary"
          size={desktop ? "compact" : "md"}
          fullWidth
          icon={copied ? CheckIcon : DocumentDuplicateIcon}
          disabled={expired}
          onClick={() => void copy()}
          className={cx(copied && "text-brand-strong")}
        >
          {copied ? householdCopy.copied : householdCopy.copyCode}
        </Button>
        <span aria-live="polite" className="sr-only">
          {copied ? householdCopy.copied : ""}
        </span>
      </section>
      {expired && !isOwner && (
        <p className="px-1 text-[13px] leading-[18px] text-ink-muted">
          Bitte {ownerName} um einen neuen Code.
        </p>
      )}
    </div>
  );
}
