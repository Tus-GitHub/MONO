import type { Metadata } from "next";
import Link from "next/link";

import { AcceptInvitationButton } from "@/components/onboarding/accept-invitation-button";
import { Logo, MonoMark } from "@/components/layout/logo";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/alert";
import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";
import { getCurrentUser } from "@/lib/auth";
import { getCoupleContext } from "@/lib/authz";
import { getInvitationByToken } from "@/server/services/invitation-service";

export const metadata: Metadata = { title: "You're invited" };

const STATE_MESSAGE: Record<string, string> = {
  accepted: "This invitation has already been used.",
  revoked: "This invitation was cancelled by the person who sent it.",
  expired: "This invitation has expired. Ask your partner to send a fresh link.",
};

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="flex h-14 items-center px-4 sm:px-6">
        <Logo />
      </header>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
        {children}
      </main>
    </div>
  );
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [user, result] = await Promise.all([getCurrentUser(), getInvitationByToken(token)]);

  if (!result) {
    return (
      <Frame>
        <MonoMark className="mb-4 h-10 w-10 text-ink" />
        <h1 className="font-display text-xl font-medium text-ink">Invitation not found</h1>
        <p className="mt-1.5 text-sm text-muted">
          This link isn&apos;t valid. Double-check it, or ask your partner to send a new one.
        </p>
        <LinkButton href="/" variant="secondary" className="mt-6">
          Go to MONO
        </LinkButton>
      </Frame>
    );
  }

  const { invitation, state } = result;
  const inviter = invitation.createdBy;
  const spaceName = invitation.couple.name;

  if (state !== "pending") {
    return (
      <Frame>
        <MonoMark className="mb-4 h-10 w-10 text-ink" />
        <h1 className="font-display text-xl font-medium text-ink">Invitation unavailable</h1>
        <p className="mt-1.5 text-sm text-muted">{STATE_MESSAGE[state]}</p>
        <LinkButton href={user ? "/home" : "/login"} variant="secondary" className="mt-6">
          {user ? "Go to MONO" : "Sign in"}
        </LinkButton>
      </Frame>
    );
  }

  const context = user ? await getCoupleContext() : null;
  const isInviter = user?.id === inviter.id;
  const alreadyCoupled = Boolean(context);

  return (
    <Frame>
      <div className="text-center">
        <div className="mx-auto flex w-fit items-center gap-2">
          <Avatar name={inviter.name} src={inviter.avatarUrl} size="lg" />
          <MonoMark className="h-6 w-6 text-faint" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-medium text-ink">
          {inviter.name} invited you
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          to their private space{spaceName ? ` “${spaceName}”` : ""} on MONO — a relationship
          journal for exactly two people.
        </p>
      </div>

      <div className="mt-8">
        {!user ? (
          <div className="space-y-3">
            <LinkButton
              href={`/register?invite=${encodeURIComponent(token)}`}
              size="lg"
              fullWidth
            >
              Create an account
            </LinkButton>
            <LinkButton
              href={`/login?invite=${encodeURIComponent(token)}`}
              size="lg"
              variant="secondary"
              fullWidth
            >
              I already have an account
            </LinkButton>
          </div>
        ) : isInviter ? (
          <Alert tone="info">
            This is the invitation you created. Send the link to your partner instead.
          </Alert>
        ) : alreadyCoupled ? (
          <Alert tone="warning">
            You&apos;re already part of a couple space, so you can&apos;t accept this invitation.
          </Alert>
        ) : (
          <AcceptInvitationButton token={token} />
        )}
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-2xs text-faint">
        <Icon name="lock" size="xs" />
        Only you can use this link. It expires and can be used once.
      </p>

      {!user ? (
        <p className="mt-2 text-center text-2xs text-faint">
          Already elsewhere?{" "}
          <Link href="/login" className="underline">
            Just sign in
          </Link>
        </p>
      ) : null}
    </Frame>
  );
}
