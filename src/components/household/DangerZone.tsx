import {
  ArrowRightStartOnRectangleIcon as LeaveIcon20,
  ChevronRightIcon,
  TrashIcon as TrashIcon20,
} from "@heroicons/react/20/solid";
import { ArrowRightStartOnRectangleIcon, TrashIcon } from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";
import { useIsDesktop } from "../../hooks/useMediaQuery";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { lifecycleCopy } from "../../lib/copy";
import { cx } from "../../lib/cx";
import { useLoadedHousehold } from "../../lib/household/useHousehold";
import { Button } from "../ui/Button";
import { InlineAlert } from "../ui/InlineAlert";
import type { HouseholdLifecycle } from "./useHouseholdLifecycle";

/**
 * «Gefahrenzone» (`Household.dc.html`, HH-08/10): phones a card with «Haushalt verlassen» and
 * «Haushalt löschen» rows and the hint below; desktop an outlined section with two buttons.
 * «Haushalt löschen» is the owner's only. Disabled with a hint for the owner of a shared
 * household and a sole member (D84), in the demo household (D96) and offline (D91); the
 * interrupted delete shows D89 above.
 */
export function DangerZone({ lifecycle }: { lifecycle: HouseholdLifecycle }) {
  const { household, isOwner } = useLoadedHousehold();
  const online = useOnlineStatus();
  const desktop = useIsDesktop();
  const { leaveState, canAct } = lifecycle;

  const leaveDisabled = !canAct || leaveState !== "ok";
  const deleteDisabled = !online || household.demo === true;
  const hint =
    leaveState === "demo"
      ? lifecycleCopy.demoBlocked
      : leaveState === "owner"
        ? lifecycleCopy.ownerHint
        : leaveState === "alone"
          ? lifecycleCopy.aloneHint
          : undefined;

  const alert = lifecycle.interrupted && (
    <InlineAlert
      tone="danger"
      action={{ label: lifecycleCopy.resumeDelete, onClick: lifecycle.resumeDelete }}
    >
      {lifecycleCopy.interrupted}
    </InlineAlert>
  );

  if (desktop) {
    return (
      <section
        aria-labelledby="gefahrenzone"
        className="flex flex-col gap-3 rounded-card px-5 py-4.5 inset-ring inset-ring-line-strong"
      >
        <h2 id="gefahrenzone" className="text-[15px] font-semibold text-ink">
          {lifecycleCopy.dangerZone}
        </h2>
        {alert}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="compact"
            icon={LeaveIcon20}
            disabled={leaveDisabled}
            onClick={lifecycle.openLeave}
          >
            {lifecycleCopy.leave}
          </Button>
          {isOwner && (
            <Button
              variant="danger-ghost"
              size="compact"
              icon={TrashIcon20}
              disabled={deleteDisabled}
              onClick={lifecycle.openDelete}
            >
              {lifecycleCopy.delete}
            </Button>
          )}
        </div>
        {hint && <p className="text-[13px] leading-[18px] text-ink-muted">{hint}</p>}
      </section>
    );
  }

  return (
    <section aria-label={lifecycleCopy.dangerZone} className="flex flex-col gap-2">
      {alert}
      <div className="overflow-hidden rounded-card bg-surface shadow-card">
        <ZoneRow
          icon={ArrowRightStartOnRectangleIcon}
          label={lifecycleCopy.leave}
          disabled={leaveDisabled}
          onClick={lifecycle.openLeave}
        />
        {isOwner && (
          <ZoneRow
            icon={TrashIcon}
            label={lifecycleCopy.delete}
            danger
            disabled={deleteDisabled}
            onClick={lifecycle.openDelete}
          />
        )}
      </div>
      {hint && <p className="px-1 text-[13px] leading-[18px] text-ink-muted">{hint}</p>}
    </section>
  );
}

/** Phone row: 56 px, icon, label, chevron; the second row has a top border. */
function ZoneRow({
  icon: Icon,
  label,
  danger = false,
  disabled,
  onClick,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  danger?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "flex min-h-14 w-full cursor-pointer items-center gap-3 border-t border-line px-4 text-left text-body first:border-t-0 disabled:cursor-not-allowed disabled:text-ink-subtle hovered:bg-sunken",
        danger ? "font-medium text-danger" : "text-ink",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cx("size-6 shrink-0", !danger && !disabled && "text-ink-muted")}
      />
      <span className="flex-1">{label}</span>
      <ChevronRightIcon aria-hidden="true" className="size-5 text-ink-subtle" />
    </button>
  );
}
