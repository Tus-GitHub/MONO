import type { ReactNode } from "react";
import type { Couple } from "@prisma/client";

import { BottomNav } from "@/components/navigation/bottom-nav";
import { Sidebar } from "@/components/navigation/sidebar";
import { TopBar } from "@/components/navigation/top-bar";
import type { SessionUser } from "@/lib/auth/current-user";

export interface ShellPerson {
  name: string;
  avatarUrl?: string | null;
}

interface AppShellProps {
  user: SessionUser;
  couple: Couple | null;
  members: ShellPerson[];
  children: ReactNode;
}

/**
 * The authenticated application frame: desktop sidebar, mobile top bar + bottom nav, and a
 * centred content column. Deliberately not an admin panel — one calm column, generous space.
 */
export function AppShell({ couple, members, children }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-paper">
      <Sidebar coupleName={couple?.name ?? null} members={members} />

      <div className="lg:pl-(--sidebar-w)">
        <TopBar members={members} />
        <main className="mx-auto w-full max-w-(--content-max) px-4 pt-6 pb-[calc(var(--bottomnav-h)+2.5rem)] sm:px-6 lg:pt-10 lg:pb-14">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
