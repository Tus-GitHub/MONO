import { redirect } from "next/navigation";

import { resolveOnboarding } from "@/lib/onboarding";
import { onboardingPath } from "@/server/services/onboarding-service";

/** Resolver — sends the user to their current onboarding step (or Home when finished). */
export default async function OnboardingIndex() {
  const { status } = await resolveOnboarding();
  redirect(onboardingPath(status.step));
}
