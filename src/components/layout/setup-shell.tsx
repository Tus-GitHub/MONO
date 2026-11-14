import { PendingFields } from "@/components/forms/pending-fields";
import type { ReactNode } from "react";

import { Logo } from "@/components/layout/logo";
import { Icon } from "@/components/ui/icon";
import { logoutAction } from "@/server/actions/auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { EmailVerificationNotice } from "@/components/auth/email-verification-notice";

/** Minimal chrome for the pre-couple onboarding step — no full navigation yet. */
export async function SetupShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="mono-setup-header flex h-14 items-center justify-between border-b border-line px-4 pt-safe sm:px-6">
        <Logo href="/onboarding" />
        <form action={logoutAction}>
          <PendingFields>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink"
            >
              <Icon name="logout" size="sm" />
              Sign out
            </button>
          </PendingFields>
        </form>
      </header>
      {/* `m-auto` (not `justify-center`) centres the card when there's room but still lets it
          scroll past both edges when the viewport is short — e.g. with the keyboard open. */}
      <main className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 py-10 sm:px-6">
        <div className="m-auto w-full max-w-xl">
          {user ? <EmailVerificationNotice verified={Boolean(user.emailVerified)} /> : null}
          {children}
        </div>
      </main>
    </div>
  );
}
