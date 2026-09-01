import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CoupleSetupForm } from "@/components/onboarding/couple-setup-form";
import { OnboardingStepper } from "@/components/onboarding/onboarding-stepper";
import { Avatar } from "@/components/ui/avatar";
import { requireOnboardingStep } from "@/lib/onboarding";
import { getCoupleWithMembers } from "@/server/services/couple-service";

export const metadata: Metadata = { title: "Your space" };

function toDateInput(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export default async function CoupleStepPage() {
  const { status } = await requireOnboardingStep("couple");
  if (!status.couple) notFound();

  const couple = await getCoupleWithMembers(status.couple.id);

  return (
    <div>
      <OnboardingStepper current="couple" />
      <h1 className="font-display text-2xl font-medium text-ink">Set up your space</h1>
      <p className="mt-1.5 text-sm text-muted">
        You&apos;re connected. Give your shared space a name and a face — either of you can edit
        it later.
      </p>

      <div className="mt-4 flex items-center gap-2">
        {couple.members.map((member) => (
          <span key={member.id} className="flex items-center gap-2 text-sm text-muted">
            <Avatar name={member.user.name} src={member.user.avatarUrl} size="sm" />
            {member.user.nickname || member.user.name}
          </span>
        ))}
      </div>

      <div className="mt-6">
        <CoupleSetupForm
          initial={{
            name: couple.name,
            description: couple.description,
            anniversaryAt: toDateInput(couple.anniversaryAt),
            photoUrl: couple.photoUrl,
          }}
        />
      </div>
    </div>
  );
}
