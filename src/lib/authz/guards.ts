import "server-only";

import { redirect } from "next/navigation";

import { getCoupleContext, type CoupleContext } from "@/lib/authz/couple";

/**
 * Server Component guard: return the couple context or send the user to onboarding.
 * Actions/route handlers use `requireCoupleContext()` (throws) instead.
 */
export async function requireCoupleOrOnboard(
  onboardingPath = "/onboarding",
): Promise<CoupleContext> {
  const context = await getCoupleContext();
  if (!context) redirect(onboardingPath);
  return context;
}

/** Inverse: keep users who already have a couple out of the onboarding flow. */
export async function redirectIfHasCouple(to = "/home"): Promise<void> {
  const context = await getCoupleContext();
  if (context) redirect(to);
}
