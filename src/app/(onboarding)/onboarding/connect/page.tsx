import type { Metadata } from "next";

import { InvitationManager } from "@/components/onboarding/invitation-manager";
import { OnboardingStepper } from "@/components/onboarding/onboarding-stepper";
import { WaitingPoll } from "@/components/onboarding/waiting-poll";
import {
  CreateSpaceButton,
  JoinCoupleForm,
} from "@/components/forms/couple-onboarding-forms";
import { Card, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { requireOnboardingStep } from "@/lib/onboarding";
import { getActiveInvitation } from "@/server/services/invitation-service";

export const metadata: Metadata = { title: "Connect" };

export default async function ConnectStepPage() {
  const { status } = await requireOnboardingStep("connect");

  // State B — already created a space, waiting for the partner.
  if (status.hasMembership && status.couple) {
    const active = await getActiveInvitation(status.couple.id);
    return (
      <div>
        <OnboardingStepper current="connect" />
        <h1 className="font-display text-2xl font-medium text-ink">Invite your partner</h1>
        <p className="mt-1.5 text-sm text-muted">
          Send them a private link. When they accept, the two of you are connected and no one
          else can join.
        </p>

        <div className="mt-6 space-y-4">
          <Card>
            <InvitationManager
              activeInvitation={
                active ? { id: active.id, expiresAt: active.expiresAt.toISOString() } : null
              }
            />
          </Card>

          <WaitingPoll />

          <details className="rounded-lg border border-line bg-surface px-4 py-3 text-sm">
            <summary className="cursor-pointer font-medium text-ink">
              Prefer a short code?
            </summary>
            <p className="mt-2 text-muted">
              Your partner can also sign up and enter this code on their own connect screen:
            </p>
            <p className="mt-2 font-mono text-base tracking-[0.2em] text-ink">
              {status.couple.inviteCode}
            </p>
          </details>
        </div>
      </div>
    );
  }

  // State A — no space yet: create one, or join the partner's.
  return (
    <div>
      <OnboardingStepper current="connect" />
      <h1 className="font-display text-2xl font-medium text-ink">Connect with your partner</h1>
      <p className="mt-1.5 text-sm text-muted">
        One of you creates the space and invites the other. A space holds exactly two people.
      </p>

      <div className="mt-6 space-y-4">
        <Card>
          <CardHeader
            icon={<Icon name="plus" size="sm" />}
            title="Create your space"
            description="You'll get a private link to send your partner."
          />
          <CreateSpaceButton />
        </Card>

        <div className="flex items-center gap-4 text-2xs font-medium uppercase tracking-wide text-faint">
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
        </div>

        <Card>
          <CardHeader
            icon={<Icon name="users" size="sm" />}
            title="Join your partner's space"
            description="Open the link they sent you, or enter their code below."
          />
          <JoinCoupleForm />
        </Card>
      </div>
    </div>
  );
}
