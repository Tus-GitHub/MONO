import { redirect } from "next/navigation";

import { resolveOnboarding } from "@/lib/onboarding";
import { onboardingPath } from "@/server/services/onboarding-service";
import { requireUser } from "@/lib/auth/current-user";
import { hasAdminAccess } from "@/lib/auth/admin";

/** Resolver — sends the user to their current onboarding step (or Home when finished). */
export default async function OnboardingIndex() {
  const user = await requireUser();
  if (await hasAdminAccess(user.id)) redirect("/admin");
  const { status } = await resolveOnboarding();
  redirect(onboardingPath(status.step));
}
