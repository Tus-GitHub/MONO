import type { ReactNode } from "react";
import type { Couple } from "@prisma/client";

import { AppHeader } from "@/components/navigation/app-header";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { Sidebar } from "@/components/navigation/sidebar";
import { OfflineBanner } from "@/components/system/offline-banner";
import { ReminderPoller } from "@/components/system/reminder-poller";
import { TogetherProvider } from "@/components/together/together-provider";
import { AppFrame } from "@/components/layout/app-frame";
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
    <TogetherProvider userId={user.id}><div className="min-h-dvh bg-paper">
      <OfflineBanner />
      <ReminderPoller />
      <AppFrame sidebar={<Sidebar coupleName={couple?.name ?? null} members={members} />}
        bottomNav={<BottomNav />} header={<AppHeader
          user={{ name: user.name, avatarUrl: user.avatarUrl }}
          unreadCount={unreadCount}
        />}>
          {children}
      </AppFrame>
    </div></TogetherProvider>
  );
}
