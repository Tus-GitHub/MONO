import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { ThemeApplier } from "@/components/settings/theme-applier";
import { CoupleSync } from "@/components/system/couple-sync";
import { coupleRevision } from "@/server/services/couple-sync-service";
import { requireCoupleContext } from "@/lib/authz";
import { requireOnboarded } from "@/lib/onboarding";
import { getCoupleMembersLite } from "@/server/services/couple-service";
import { getUnreadNotificationCount } from "@/server/services/notification-service";
import { getUserSettings } from "@/server/services/user-settings-service";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Finished onboarding, or this redirects to the right step.
  const { user } = await requireOnboarded();
  const { couple } = await requireCoupleContext();
  const [members, settings, unreadCount, revision] = await Promise.all([
    getCoupleMembersLite(couple.id),
    getUserSettings(user.id),
    getUnreadNotificationCount(user.id).catch(() => 0),
    coupleRevision(couple.id, couple.updatedAt),
  ]);

  return (
    <AppShell user={user} couple={couple} members={members} unreadCount={unreadCount}>
      <ThemeApplier theme={settings.theme} />
      <CoupleSync revision={revision} />
      {children}
    </AppShell>
  );
}
