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
      {/* `m-auto` (not `justify-center`) centres the card when there's room but still lets it
          scroll past both edges when the viewport is short — e.g. with the keyboard open. */}
      <main className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 py-10 sm:px-6">
        <div className="m-auto w-full max-w-xl">{children}</div>
      </main>
    </div>
  );
}
