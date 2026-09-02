import type { ReactNode } from "react";
import type { Couple } from "@prisma/client";

import { AppHeader } from "@/components/navigation/app-header";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { Sidebar } from "@/components/navigation/sidebar";
import { OfflineBanner } from "@/components/system/offline-banner";
import { ReminderPoller } from "@/components/system/reminder-poller";
import type { SessionUser } from "@/lib/auth/current-user";

export interface ShellPerson {
  name: string;
  avatarUrl?: string | null;
}

interface AppShellProps {
  user: SessionUser;
  couple: Couple | null;
  members: ShellPerson[];
  unreadCount: number;
  children: ReactNode;
}

/**
 * The authenticated application frame: desktop sidebar, a persistent header carrying the
 * notification + account controls, mobile bottom nav, and a content column each page sizes
 * for itself via <PageContainer>. Deliberately not an admin panel — calm, generous space.
 */
export function AppShell({ user, couple, members, unreadCount, children }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-paper">
      <OfflineBanner />
      <ReminderPoller />
      <Sidebar coupleName={couple?.name ?? null} members={members} />

      <div className="lg:pl-(--sidebar-w)">
        <AppHeader
          user={{ name: user.name, avatarUrl: user.avatarUrl }}
          unreadCount={unreadCount}
        />
        <main className="mx-auto w-full max-w-(--content-wide) px-4 pt-6 pb-[calc(var(--bottomnav-h)+2.5rem)] sm:px-6 lg:px-8 lg:pt-8 lg:pb-16">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
