import { ExclamationCircleIcon, LockClosedIcon } from "@heroicons/react/16/solid";
import { useState } from "react";
import { TIME_ZONES, timeZoneLabel } from "../../domain/timeZones";
import { useIsDesktop } from "../../hooks/useMediaQuery";
import { firestoreErrorMessage } from "../../lib/firestoreErrors";
import { updateHouseholdSettings } from "../../services/householdService";
import type { Household, HouseholdSettingsUpdate, WeekStart } from "../../types";
import { SegmentedControl } from "../ui/SegmentedControl";
import { Select } from "../ui/Select";
import { TextField } from "../ui/TextField";
import { HouseholdSection } from "./HouseholdSection";
import { useAutosaveName } from "./useAutosaveName";

const weekStartOptions = [
  { value: "1", label: "Montag" },
  { value: "0", label: "Sonntag" },
];

/**
 * «Einstellungen» (HH-07): name, week start, time zone. Saved on change / blur (B1). Only the
 * owner may change them; members see the disabled fields and a caption (D5).
 */
export function HouseholdSettings({
  household,
  isOwner,
  ownerName,
}: {
  household: Household;
  isOwner: boolean;
  ownerName: string;
}) {
  const desktop = useIsDesktop();
  const disabled = !isOwner;
  const [errors, setErrors] = useState<{ weekStartsOn?: string; timeZone?: string }>({});
  const name = useAutosaveName(household.name, (value) =>
    updateHouseholdSettings(household, { name: value }),
  );

  async function save(field: "weekStartsOn" | "timeZone", update: HouseholdSettingsUpdate) {
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
