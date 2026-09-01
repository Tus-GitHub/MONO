import type { ReactNode } from "react";

import { Logo, MonoMark } from "@/components/layout/logo";
import { Icon } from "@/components/ui/icon";
import { redirectIfAuthenticated } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  await redirectIfAuthenticated();

  return (
    <div className="grid min-h-dvh w-full max-w-full grid-cols-1 overflow-x-clip lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-surface p-10 lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-24 size-96 rounded-full bg-primary-tint/50 blur-3xl motion-safe:anim-drift"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-24 size-80 rounded-full bg-accent-tint/50 blur-3xl motion-safe:anim-drift"
          style={{ animationDelay: "-7s" }}
        />

        <Logo />

        <div className="relative z-10 max-w-sm">
          <MonoMark className="h-14 w-14 text-ink motion-safe:anim-breathe" />
          <p className="mt-6 font-display text-[1.75rem] leading-snug text-ink">
            Your dates. Your memories. Your story.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            MONO is a private record of your time together — plans, photos, spending, and the
            small verdicts you reach as a two. No feed, no followers, no one else.
          </p>
        </div>

        <p className="relative z-10 flex items-center gap-2 text-xs text-faint">
          <Icon name="lock" size="xs" />
          Invite-only · exactly two people per space · your data stays yours
        </p>
      </aside>

      <main className="flex w-full min-w-0 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
