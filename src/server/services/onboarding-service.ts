import "server-only";

import { CoupleMemberStatus, CoupleStatus, type CoupleMemberRole } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

/**
 * Onboarding is a small state machine:
 *
 *   new account            → profile   (name, photo, nickname)
 *   profile complete       → connect   (create a space + invite, or accept an invite)
 *   both people connected  → couple    (space name, photo, relationship date)
 *   space set up           → ready     (Home)
 *
 * A step is never shown again once its marker (`profileCompletedAt`, an ACTIVE couple,
 * `setupCompletedAt`) is set.
 */
export type OnboardingStep = "profile" | "connect" | "couple" | "ready";

export interface OnboardingStatus {
  step: OnboardingStep;
  profileComplete: boolean;
  hasMembership: boolean;
  connected: boolean;
  coupleSetupComplete: boolean;
  couple: {
    id: string;
    name: string | null;
    inviteCode: string;
    status: CoupleStatus;
    role: CoupleMemberRole;
  } | null;
}

export async function getOnboardingStatus(userId: string): Promise<OnboardingStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      profileCompletedAt: true,
      memberships: {
        where: {
          status: CoupleMemberStatus.ACTIVE,
          couple: { deletedAt: null },
        },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          role: true,
          couple: {
            select: {
              id: true,
              name: true,
              inviteCode: true,
              status: true,
              setupCompletedAt: true,
            },
          },
        },
      },
    },
  });

  const membership = user?.memberships[0] ?? null;
  const profileComplete = Boolean(user?.profileCompletedAt);
  const hasMembership = Boolean(membership);
  const connected = membership?.couple.status === CoupleStatus.ACTIVE;
  const coupleSetupComplete = Boolean(membership?.couple.setupCompletedAt);

  let step: OnboardingStep;
  if (!profileComplete) step = "profile";
  else if (!connected) step = "connect";
  else if (!coupleSetupComplete) step = "couple";
  else step = "ready";

  return {
    step,
    profileComplete,
    hasMembership,
    connected,
    coupleSetupComplete,
    couple: membership
      ? {
          id: membership.couple.id,
          name: membership.couple.name,
          inviteCode: membership.couple.inviteCode,
          status: membership.couple.status,
          role: membership.role,
        }
      : null,
  };
}

export function onboardingPath(step: OnboardingStep): string {
  switch (step) {
    case "profile":
      return "/onboarding/profile";
    case "connect":
      return "/onboarding/connect";
    case "couple":
      return "/onboarding/couple";
    case "ready":
      return "/home";
  }
}

export const ONBOARDING_STEP_ORDER: OnboardingStep[] = ["profile", "connect", "couple", "ready"];

export const ONBOARDING_STEP_META: Record<
  Exclude<OnboardingStep, "ready">,
  { index: number; label: string }
> = {
  profile: { index: 1, label: "Your profile" },
  connect: { index: 2, label: "Connect" },
  couple: { index: 3, label: "Your space" },
};
