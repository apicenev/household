import { KeyIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AccountMenu } from "../../components/layout/AccountMenu";
import { AuthLayout } from "../../components/layout/AuthLayout";
import { OfflineBanner } from "../../components/layout/OfflineBanner";
import { ChoiceCards, type Choice } from "../../components/onboarding/ChoiceCards";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { useCurrentMember } from "../../lib/auth/useCurrentMember";

type Start = "create" | "join";

const choices: Choice<Start>[] = [
  {
    value: "create",
    title: "Haushalt erstellen",
    text: "Du startest einen neuen Haushalt und lädst die anderen ein.",
    icon: PlusIcon,
  },
  {
    value: "join",
    title: "Mit Code beitreten",
    // The design says «einen Code oder Link»: there is no link (B9).
    text: "Jemand hat dir einen Code geschickt.",
    icon: KeyIcon,
  },
];

/** /onboarding «Auswahl» (AUTH-06): create a household or join one with a code. */
export default function OnboardingChoicePage() {
  const member = useCurrentMember();
  const navigate = useNavigate();
  const [start, setStart] = useState<Start>("create");
  const questionId = useId();
  useDocumentTitle("Haushalt einrichten");

  const firstName = member.name.trim().split(/\s+/)[0] ?? member.name;

  return (
    <AuthLayout>
      <div className="flex flex-1 flex-col gap-7">
        <OfflineBanner />
        <div className="flex flex-col items-start gap-2.5">
          {/* D6: the avatar opens the account menu, with only «Abmelden». */}
          <AccountMenu
            logoutOnly
            align="start"
            trigger={(props) => (
              <button
                {...props}
                type="button"
                aria-label="Kontomenü"
                className="flex cursor-pointer rounded-pill"
              >
                <Avatar initials={member.initials} color={member.avatarColor} size={56} />
              </button>
            )}
          />
          <h1 className="font-display text-display text-ink">Hallo {firstName}</h1>
          <p id={questionId} className="text-body text-ink-muted">
            Wie möchtest du starten?
          </p>
        </div>
        <ChoiceCards
          choices={choices}
          value={start}
          onChange={setStart}
          aria-labelledby={questionId}
          className="-mx-1"
        />
        <Button
          size="lg"
          fullWidth
          onClick={() => navigate(`/onboarding/${start}`)}
          className="mt-auto lg:mt-0"
        >
          Weiter
        </Button>
      </div>
    </AuthLayout>
  );
}
