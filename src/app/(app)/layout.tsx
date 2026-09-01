import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { requireCoupleContext } from "@/lib/authz";
import { requireOnboarded } from "@/lib/onboarding";
import { getCoupleMembersLite } from "@/server/services/couple-service";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Finished onboarding, or this redirects to the right step.
  const { user } = await requireOnboarded();
  const { couple } = await requireCoupleContext();
  const members = await getCoupleMembersLite(couple.id);

  return (
    <AppShell user={user} couple={couple} members={members}>
      {children}
    </AppShell>
  );
}
