import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { useId, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import type { EventOccurrence, Member } from "../../types";
import { CategoryLabel } from "../ui/CategoryLabel";
import { ruleLine, spanLabel, timeColumn, timeLine } from "./calendarLabels";
import { ParticipantAvatars } from "./ParticipantAvatars";

interface EventCardProps {
  occurrence: EventOccurrence;
  dayKey: string;
  timeZone: string;
  members: readonly Member[];
}

/** Category pill and «Tag 3 von 8» (D54) under the title. */
function MetaRow({ occurrence, dayKey }: { occurrence: EventOccurrence; dayKey: string }) {
  const span = spanLabel(occurrence, dayKey);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <CategoryLabel kind="event" category={occurrence.event.category} size="sm" />
      {span && <span className="text-[13px] text-ink-muted">{span}</span>}
    </span>
  );
}

/**
 * Phone card of the selected day (`Calendar.dc.html`): time column, title, category, «Tag n
 * von m», avatars. A tap opens the Termin-Detail (D45), so there is no inline expand here.
 */
export function MobileEventCard({
  occurrence,
  dayKey,
  timeZone,
  members,
  onOpen,
}: EventCardProps & { onOpen: () => void }) {
  const time = timeColumn(occurrence, dayKey, timeZone);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex cursor-pointer gap-3.5 rounded-card bg-surface px-4 py-3.5 text-left text-ink shadow-card"
    >
      <span className="flex w-17 shrink-0 flex-col text-body-sm font-semibold tabular-nums">
        <span>{time.primary}</span>
        {time.secondary && <span className="font-medium text-ink-muted">{time.secondary}</span>}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-body leading-5.5 font-semibold">{occurrence.event.title}</span>
        <MetaRow occurrence={occurrence} dayKey={dayKey} />
      </span>
      <ParticipantAvatars
        participants={occurrence.event.participants}
        members={members}
        className="self-start pt-0.5"
      />
    </button>
  );
}

/**
 * Desktop card in «Ausgewählter Tag» (`Calendar.dc.html`): a disclosure that expands to the
 * rule line, the description and the actions (slice C).
 */
export function DesktopEventCard({
  occurrence,
  dayKey,
  timeZone,
  members,
  open,
  onToggle,
  actions,
}: EventCardProps & { open: boolean; onToggle: () => void; actions?: ReactNode }) {
  const detailsId = useId();
  const { event } = occurrence;
  return (
    <div
      className={cx(
        "flex flex-col rounded-card bg-surface text-ink",
        open ? "shadow-card ring-2 ring-brand" : "shadow-card",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={onToggle}
        className="flex cursor-pointer flex-col gap-2.5 rounded-card p-4 text-left"
      >
        <span className="flex items-start gap-2.5">
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-body leading-5.5 font-semibold">{event.title}</span>
            <span className="text-body-sm text-ink-muted tabular-nums">
              {timeLine(occurrence, dayKey, timeZone)}
            </span>
          </span>
          <ParticipantAvatars participants={event.participants} members={members} />
        </span>
        <MetaRow occurrence={occurrence} dayKey={dayKey} />
      </button>
      {open && (
        <div id={detailsId} className="mx-4 mb-4 flex flex-col gap-2 border-t border-line pt-2.5">
          <span className="flex items-center gap-1.5 text-body-sm font-semibold tabular-nums">
            <ArrowPathIcon aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
            {ruleLine(occurrence, timeZone, members)}
          </span>
          {event.description && (
            <p className="text-body-sm whitespace-pre-line text-ink-muted">{event.description}</p>
          )}
          {actions && <div className="flex gap-2 pt-1">{actions}</div>}
        </div>
      )}
    </div>
  );
}
