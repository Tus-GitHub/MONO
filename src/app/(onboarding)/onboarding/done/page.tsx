import type { Metadata } from "next";

import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";
import { MonoMark } from "@/components/layout/logo";
import { requireOnboarded } from "@/lib/onboarding";
import { getCoupleWithMembers } from "@/server/services/couple-service";

export const metadata: Metadata = { title: "You're connected" };

export default async function OnboardingDonePage() {
  const { status } = await requireOnboarded();
  const couple = await getCoupleWithMembers(status.couple!.id);
  const [a, b] = couple.members;

  return (
    <div className="anim-rise text-center">
      <div className="relative mx-auto mb-6 grid h-40 w-full max-w-md place-items-center overflow-hidden rounded-2xl border border-line bg-surface">
        {couple.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={couple.photoUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-linear-to-br from-primary-tint/70 via-transparent to-accent-tint/60" />
        )}
        <div className="relative z-10 flex -space-x-3">
          {a ? <Avatar name={a.user.name} src={a.user.avatarUrl} size="xl" ring /> : null}
          {b ? <Avatar name={b.user.name} src={b.user.avatarUrl} size="xl" ring /> : null}
        </div>
      </div>

      <MonoMark className="mx-auto h-8 w-8 text-ink" />
      <h1 className="mt-4 font-display text-3xl font-medium text-ink">
        {couple.name ? couple.name : "You're connected"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {[a, b]
          .map((member) => member?.user.nickname || member?.user.name)
          .filter(Boolean)
          .join(" & ")}
        {couple.anniversaryAt
          ? ` · since ${new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(couple.anniversaryAt)}`
          : ""}
      </p>

      <div className="mx-auto mt-6 flex max-w-sm items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">
        <Icon name="lock" size="sm" className="text-muted" />
        This space is private to the two of you. No one else can see or join it.
      </div>

      <LinkButton href="/home" size="lg" className="mt-8" trailingIcon={<Icon name="arrowRight" size="sm" />}>
        Enter MONO
      </LinkButton>
    </div>
  );
}
