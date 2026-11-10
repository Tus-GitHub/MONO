import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { SessionSettings } from "@/components/settings/session-settings";
import { requireCoupleOrOnboard } from "@/lib/authz";
import { listAuthSessions } from "@/server/services/session-service";

export const metadata: Metadata = { title: "Devices & sessions" };

export default async function SessionSettingsPage() {
  const { couple } = await requireCoupleOrOnboard();
  const sessions = await listAuthSessions();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Devices & sessions" description="See where you're signed in and choose what stays connected."
        back={{ href: "/settings", label: "Settings" }} />
      <SessionSettings timezone={couple.timezone} initial={sessions.map((session) => ({
        ...session, createdAt: session.createdAt.toISOString(), lastSeenAt: session.lastSeenAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
      }))} />
    </div>
  );
}
