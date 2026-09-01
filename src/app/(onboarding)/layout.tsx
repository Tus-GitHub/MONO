import type { ReactNode } from "react";

import { SetupShell } from "@/components/layout/setup-shell";
import { requireUserOrRedirect } from "@/lib/auth";

export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  await requireUserOrRedirect();
  return <SetupShell>{children}</SetupShell>;
}
