import type { Metadata } from "next";

import { OnboardingStepper } from "@/components/onboarding/onboarding-stepper";
import { ProfileSetupForm } from "@/components/onboarding/profile-setup-form";
import { requireOnboardingStep } from "@/lib/onboarding";
import { getProfile } from "@/server/services/profile-service";

export const metadata: Metadata = { title: "Your profile" };

function toDateInput(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export default async function ProfileStepPage() {
  const { user } = await requireOnboardingStep("profile");
  const profile = await getProfile(user.id);

  return (
    <div>
      <OnboardingStepper current="profile" />
      <h1 className="font-display text-2xl font-medium text-ink">Set up your profile</h1>
      <p className="mt-1.5 text-sm text-muted">
        This is how you&apos;ll show up in your shared space. You can change it any time.
      </p>

      <div className="mt-6">
        <ProfileSetupForm
          initial={{
            name: profile.name,
            nickname: profile.nickname,
            pronouns: profile.pronouns,
            birthday: toDateInput(profile.birthday),
            avatarUrl: profile.avatarUrl,
          }}
        />
      </div>
    </div>
  );
}
