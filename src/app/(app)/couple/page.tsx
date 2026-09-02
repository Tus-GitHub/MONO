import type { Metadata } from "next";
import Link from "next/link";
import { CoupleStatus } from "@prisma/client";

import { CategoryPreferences } from "@/components/couple/category-preferences";
import { CoupleInsights } from "@/components/couple/couple-insights";
import { CoupleProfileHeader } from "@/components/couple/couple-profile-header";
import { DateStatistics } from "@/components/couple/date-statistics";
import { InviteCodeCard } from "@/components/couple/invite-code-card";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";
import { requireCoupleOrOnboard } from "@/lib/authz";
import { getCoupleProfile } from "@/server/services/couple-insights-service";

export const metadata: Metadata = { title: "Couple" };

export default async function CouplePage() {
  const { user, couple } = await requireCoupleOrOnboard();
  const profile = await getCoupleProfile(couple.id, user.id);

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        title="Couple"
        description="Your shared space, and the story the two of you have built so far."
        action={
          <LinkButton href="/settings/couple" variant="secondary" size="sm">
            Edit profile
          </LinkButton>
        }
      />

      {couple.status === CoupleStatus.PENDING ? (
        <InviteCodeCard code={couple.inviteCode} />
      ) : null}

      <CoupleProfileHeader profile={profile} />
      <DateStatistics stats={profile.statistics} moneyHidden={profile.moneyInsightsHidden} />
      <CategoryPreferences profile={profile} />
      <CoupleInsights insights={profile.insights} />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium text-ink">Settings</h2>
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          <SettingsLink href="/settings" label="All settings" hint="Privacy, theme, data, account" />
          <SettingsLink href="/settings/couple" label="Couple profile" hint="Name, photo, relationship date" />
          <SettingsLink href="/settings/profile" label="Your profile" hint="How you show up here" />
          <SettingsLink href="/settings/notifications" label="Reminders" hint="What MONO nudges you about" />
        </div>
      </section>
    </PageContainer>
  );
}

function SettingsLink({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-paper/70"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="truncate text-xs text-muted">{hint}</p>
      </div>
      <Icon name="chevronRight" size="sm" className="shrink-0 text-faint" />
    </Link>
  );
}
