import "server-only";
import { cache } from "react";

import { redirect } from "next/navigation";

import type { SessionUser } from "@/lib/auth/current-user";
import { requireUserOrRedirect } from "@/lib/auth/guards";
import {
  getOnboardingStatus,
  onboardingPath,
  type OnboardingStatus,
  type OnboardingStep,
} from "@/server/services/onboarding-service";

interface Guarded {
  user: SessionUser;
  status: OnboardingStatus;
}

/** Feature-page guard: finished onboarding, or bounce to the current step. */
export const requireOnboarded = cache(async (): Promise<Guarded> => {
  const user = await requireUserOrRedirect();
  const status = await getOnboardingStatus(user.id);
  if (status.step !== "ready") redirect(onboardingPath(status.step));
  return { user, status };
});

/** Onboarding step-page guard: this must be the user's current step. */
export async function requireOnboardingStep(
  step: Exclude<OnboardingStep, "ready">,
): Promise<Guarded> {
  const user = await requireUserOrRedirect();
  const status = await getOnboardingStatus(user.id);
  if (status.step === "ready") redirect("/home");
  if (status.step !== step) redirect(onboardingPath(status.step));
  return { user, status };
}

/** Just resolve where the user should be right now (no redirect). */
export async function resolveOnboarding(): Promise<Guarded> {
  const user = await requireUserOrRedirect();
  const status = await getOnboardingStatus(user.id);
  return { user, status };
}
