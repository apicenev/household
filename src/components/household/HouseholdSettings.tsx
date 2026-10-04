import { ExclamationCircleIcon, LockClosedIcon } from "@heroicons/react/16/solid";
import { useState } from "react";
import { defaultRotationOrder } from "../../domain/rotation";
import { TIME_ZONES, timeZoneLabel } from "../../domain/timeZones";
import { useIsDesktop } from "../../hooks/useMediaQuery";
import { recurrenceCopy } from "../../lib/copy";
import { firestoreErrorMessage } from "../../lib/firestoreErrors";
import { updateHouseholdSettings } from "../../services/householdService";
import type { Household, HouseholdSettingsUpdate, Member, WeekStart } from "../../types";
import { RotationPicker } from "../ui/RotationPicker";
import { SegmentedControl } from "../ui/SegmentedControl";
import { Select } from "../ui/Select";
import { TextField } from "../ui/TextField";
import { HouseholdSection } from "./HouseholdSection";
import { useAutosaveName } from "./useAutosaveName";

const weekStartOptions = [
  { value: "1", label: "Montag" },
  { value: "0", label: "Sonntag" },
];

type SettingsField = "weekStartsOn" | "timeZone" | "rotationOrder";

/**
 * «Einstellungen» (HH-07): name, week start, time zone and, from Phase 4, the default order of
 * new rotations (D30, hidden with a single member). Saved on change / blur (B1). Only the
 * owner may change them; members see the disabled fields and a caption (D5).
 */
export function HouseholdSettings({
  household,
  members,
  isOwner,
  ownerName,
}: {
  household: Household;
  members: Member[];
  isOwner: boolean;
  ownerName: string;
}) {
  const desktop = useIsDesktop();
  const disabled = !isOwner;
  const [errors, setErrors] = useState<Partial<Record<SettingsField, string>>>({});
  const order = defaultRotationOrder(household.rotationOrder, members, null);
  const name = useAutosaveName(household.name, (value) =>
    updateHouseholdSettings(household, { name: value }),
  );

  async function save(field: SettingsField, update: HouseholdSettingsUpdate) {
    setErrors((current) => ({ ...current, [field]: undefined }));
    try {
      await updateHouseholdSettings(household, update);
    } catch (error) {
      setErrors((current) => ({ ...current, [field]: firestoreErrorMessage(error) }));
    }
  }

  // Phones: «Europa/Zürich (MEZ)»; desktop without the abbreviation, as designed (B6).
  const now = new Date();
  const zoneOptions = TIME_ZONES.map((zone) => ({
    value: zone.id,
    label: timeZoneLabel(zone.id, now, { abbreviation: !desktop }),
  }));

  return (
    <HouseholdSection
      title="Einstellungen"
      note={disabled ? `Nur ${ownerName} kann die Einstellungen ändern.` : undefined}
    >
      <TextField
        label="Name"
        name="householdName"
        autoComplete="off"
        {...name}
        disabled={disabled}
        leading={disabled ? <LockClosedIcon className="size-4" /> : undefined}
        inputClassName="lg:h-11"
      />
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-body-sm font-semibold text-ink">Woche beginnt am</span>
          <SegmentedControl
            aria-label="Woche beginnt am"
            options={weekStartOptions}
            value={String(household.weekStartsOn)}
            onChange={(value) =>
              void save("weekStartsOn", { weekStartsOn: Number(value) as WeekStart })
            }
            size={desktop ? "sm" : "md"}
            disabled={disabled}
          />
          {errors.weekStartsOn && <FieldError>{errors.weekStartsOn}</FieldError>}
        </div>
        <Select
          label="Zeitzone"
          name="timeZone"
          options={zoneOptions}
          value={household.timeZone}
          onChange={(event) => void save("timeZone", { timeZone: event.target.value })}
          disabled={disabled}
          error={errors.timeZone}
          selectClassName="lg:h-10.5"
        />
      </div>
      {members.length >= 2 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-body-sm font-semibold text-ink">{recurrenceCopy.orderLabel}</span>
          <span className="text-[13px] leading-[18px] text-ink-muted">
            {recurrenceCopy.orderHelper}
          </span>
          <RotationPicker
            order={order}
            onChange={(rotationOrder) => void save("rotationOrder", { rotationOrder })}
            members={members}
            disabled={disabled}
            aria-label={recurrenceCopy.orderLabel}
          />
          {errors.rotationOrder && <FieldError>{errors.rotationOrder}</FieldError>}
        </div>
      )}
    </HouseholdSection>
  );
}

/** The field error line from the component sheet, for controls without a Field wrapper. */
function FieldError({ children }: { children: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[13px] leading-[18px] font-medium text-danger">
      <ExclamationCircleIcon aria-hidden="true" className="size-4 shrink-0" />
      {children}
    </span>
  );
}
