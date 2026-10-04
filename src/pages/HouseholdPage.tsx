import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { HouseholdSettings } from "../components/household/HouseholdSettings";
import { InviteCard } from "../components/household/InviteCard";
import { MemberList } from "../components/household/MemberList";
import { MyProfile } from "../components/household/MyProfile";
import { useToast } from "../components/ui/toastContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useAuth } from "../lib/auth/useAuth";
import { areas, memberCountLabel } from "../lib/copy";
import { firestoreErrorMessage } from "../lib/firestoreErrors";
import { formatNumericDate } from "../lib/format";
import { useLoadedHousehold } from "../lib/household/useHousehold";
import { regenerateInvite } from "../services/inviteService";

/**
 * /household «Haushalt» (`Household.dc.html`): Mitglieder, Einladen, Einstellungen, Mein
 * Profil. Phones: one column; desktop: household name as the title and two columns. No
 * Gefahrenzone and no member menu until Phase 9 (B2, B3).
 */
export default function HouseholdPage() {
  const { household, members, isOwner, memberById } = useLoadedHousehold();
  const { user, profile } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [regenerating, setRegenerating] = useState(false);
  useDocumentTitle(areas.household);

  const ownerName = memberById(household.ownerId)?.displayName ?? "";

  // The account menu's «Profil» links to #profil; React Router doesn't scroll to hashes.
  // location.key changes on every click, also when already on the page.
  useEffect(() => {
    if (location.hash === "#profil") {
      document.getElementById("profil")?.scrollIntoView({ block: "start" });
    }
  }, [location.hash, location.key]);

  async function newCode() {
    if (!profile) return;
    setRegenerating(true);
    try {
      await regenerateInvite(household, profile);
    } catch (error) {
      toast.show({ message: firestoreErrorMessage(error), tone: "error" });
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 lg:mx-auto lg:w-full lg:max-w-250">
      {/* Phones show «Haushalt» in the top bar; the household name stays the page heading. */}
      <header className="sr-only lg:not-sr-only lg:flex lg:flex-col lg:gap-1">
        <h1 className="font-display text-[40px] leading-[46px] font-medium tracking-[-0.015em] text-ink">
          {household.name}
        </h1>
        <p className="text-[15px] text-ink-muted">
          {memberCountLabel(members.length)} · erstellt am{" "}
          {formatNumericDate(household.createdAt, household.timeZone)}
        </p>
      </header>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:gap-5">
        <div className="flex flex-col gap-6 lg:gap-5">
          <MemberList members={members} myUid={user?.uid ?? ""} timeZone={household.timeZone} />
          <InviteCard
            household={household}
            isOwner={isOwner}
            ownerName={ownerName}
            onNewCode={() => void newCode()}
            regenerating={regenerating}
          />
        </div>
        <div className="flex flex-col gap-6 lg:gap-5">
          <HouseholdSettings
            household={household}
            members={members}
            isOwner={isOwner}
            ownerName={ownerName}
          />
          {profile && (
            <MyProfile profile={profile} household={household} email={user?.email ?? ""} />
          )}
        </div>
      </div>
    </div>
  );
}
