import { useState } from "react";
import { initialsFor, validateDisplayName } from "../../domain/member";
import { useIsDesktop } from "../../hooks/useMediaQuery";
import { firestoreErrorMessage } from "../../lib/firestoreErrors";
import { updateMyProfile } from "../../services/memberService";
import type { AvatarColor, Household, UserProfile } from "../../types";
import { Avatar } from "../ui/Avatar";
import { TextField } from "../ui/TextField";
import { AvatarColorPicker } from "./AvatarColorPicker";
import { HouseholdSection } from "./HouseholdSection";
import { useAutosaveName } from "./useAutosaveName";

/**
 * «Mein Profil» (HH-05): name and avatar colour, saved on blur / change (B1) into the profile
 * and the member doc. The avatar preview follows the typed name live. Target of the account
 * menu's «Profil» (`#profil`).
 */
export function MyProfile({
  profile,
  household,
  email,
}: {
  profile: UserProfile;
  household: Household;
  email: string;
}) {
  const desktop = useIsDesktop();
  const [colorError, setColorError] = useState<string>();
  const name = useAutosaveName(profile.displayName, (displayName) =>
    updateMyProfile(profile, household, { displayName }),
  );

  // Live preview: initials of the typed name while it's valid.
  const typed = validateDisplayName(name.value);
  const initials = typed.ok ? initialsFor(typed.name) : profile.initials;
  const shownName = typed.ok ? typed.name : profile.displayName;

  async function changeColor(avatarColor: AvatarColor) {
    if (avatarColor === profile.avatarColor) return;
    setColorError(undefined);
    try {
      await updateMyProfile(profile, household, { avatarColor });
    } catch (error) {
      setColorError(firestoreErrorMessage(error));
    }
  }

  const nameField = (
    <TextField
      label="Name"
      name="displayName"
      autoComplete="name"
      {...name}
      className={desktop ? "flex-1" : undefined}
      inputClassName="lg:h-11"
    />
  );

  return (
    <HouseholdSection title="Mein Profil" id="profil" className="scroll-mt-16 lg:scroll-mt-10">
      {desktop ? (
        <div className="flex items-center gap-3.5">
          <Avatar
            initials={initials}
            color={profile.avatarColor}
            size={56}
            typeface="display"
            className="transition-colors duration-(--duration-base)"
          />
          {nameField}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3.5">
            <Avatar
              initials={initials}
              color={profile.avatarColor}
              size={64}
              className="transition-colors duration-(--duration-base)"
            />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-heading text-ink">{shownName}</span>
              <span className="truncate text-[13px] leading-[18px] text-ink-muted">{email}</span>
            </span>
          </div>
          {nameField}
        </>
      )}
      <div className="flex flex-col gap-1.5">
        <AvatarColorPicker
          value={profile.avatarColor}
          initials={initials}
          onChange={(color) => void changeColor(color)}
        />
        {colorError && (
          <span role="alert" className="text-[13px] leading-[18px] font-medium text-danger">
            {colorError}
          </span>
        )}
      </div>
    </HouseholdSection>
  );
}
