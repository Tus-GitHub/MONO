import type { ReactNode } from "react";

import { Logo } from "@/components/layout/logo";
import { Icon } from "@/components/ui/icon";
import { logoutAction } from "@/server/actions/auth";

/** Minimal chrome for the pre-couple onboarding step — no full navigation yet. */
export function SetupShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="flex h-14 items-center justify-between border-b border-line px-4 pt-safe sm:px-6">
        <Logo href="/onboarding" />
        <form action={logoutAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink"
          >
            <Icon name="logout" size="sm" />
            Sign out
          </button>
        </form>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        {children}
      </main>
    </div>
  );
}
