import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import type { FormEvent, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { actions } from "../../lib/copy";
import { AuthLayout } from "../layout/AuthLayout";
import { OfflineBanner } from "../layout/OfflineBanner";
import { IconButton } from "../ui/IconButton";

/**
 * Frame of «Haushalt erstellen» and «Mit Code beitreten» (`Auth Onboarding` → Onboarding):
 * offline banner (D11), back chevron, title and lead, the step's fields and the primary
 * button at the bottom. One form, so Enter submits.
 */
export function OnboardingStep({
  title,
  lead,
  onSubmit,
  footer,
  children,
}: {
  title: string;
  lead: string;
  onSubmit: () => void;
  /** The primary button. */
  footer: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  // Same as the browser's back button; opened directly, back leads to the choice.
  function goBack() {
    if (location.key !== "default") navigate(-1);
    else navigate("/onboarding");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <AuthLayout compactTop>
      <form noValidate onSubmit={handleSubmit} className="flex flex-1 flex-col gap-6">
        <OfflineBanner />
        <IconButton
          aria-label={actions.back}
          icon={ChevronLeftIcon}
          variant="brand"
          onClick={goBack}
          className="-ml-3"
        />
        <div className="flex flex-col gap-2.5">
          <h1 className="font-display text-display text-ink">{title}</h1>
          <p className="text-body text-ink-muted">{lead}</p>
        </div>
        {children}
        <div className="mt-auto lg:mt-0">{footer}</div>
      </form>
    </AuthLayout>
  );
}
