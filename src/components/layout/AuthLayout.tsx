import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Avatar } from "../ui/Avatar";

/**
 * Full-screen layout of the auth screens (`Auth Onboarding`): one column on canvas on phones;
 * from lg a split view with the brand panel on the left and a 400 px column on the right.
 */
export function AuthLayout({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-2">
      <BrandPanel />
      <main className="flex min-h-dvh flex-col px-6 pt-[calc(env(safe-area-inset-top)+--spacing(12))] pb-[max(--spacing(6),env(safe-area-inset-bottom))] lg:items-center lg:justify-center lg:px-30 lg:py-12">
        <div
          className={cx(
            "flex w-full flex-1 flex-col sm:mx-auto sm:max-w-100 lg:w-100 lg:flex-none",
            className,
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

/**
 * Left half on desktop. The design shows a photo («Wohnküche, warmes Abendlicht»); until a
 * licensed image exists it is a brand-coloured panel (logged in docs/design/README.md).
 */
function BrandPanel() {
  return (
    <div aria-hidden="true" className="m-4 hidden items-end rounded-[24px] bg-brand p-8 lg:flex">
      <div className="flex max-w-85 items-center gap-3 rounded-card bg-surface px-5 py-4.5 shadow-raised">
        <span className="flex shrink-0">
          <Avatar initials="NA" color={6} size={36} className="ring-2 ring-surface" />
          <Avatar initials="AN" color={1} size={36} className="-ml-2 ring-2 ring-surface" />
        </span>
        <span className="text-[15px] leading-[21px] text-ink">
          Aufgaben, Einkauf und Kalender – gemeinsam und live.
        </span>
      </div>
    </div>
  );
}
