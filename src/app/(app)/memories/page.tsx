import type { Metadata } from "next";
import Link from "@/components/ui/app-link";

import { CompactDateCard } from "@/components/dates/cards/compact-date-card";
import { GridDateCard } from "@/components/dates/cards/grid-date-card";
import { MemoryDateCard } from "@/components/dates/cards/memory-date-card";
import { MemoriesNav } from "@/components/memories/memories-nav";
import { MilestoneBadge } from "@/components/memories/milestone-badge";
import { PhotoWall } from "@/components/memories/photo-wall";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { PlanDateButton } from "@/components/navigation/plan-date-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { requireOnboarded } from "@/lib/onboarding";
import { getMemoryHome, getOngoingMemoryDates } from "@/server/services/memory-service";
import { OngoingDatePhotos } from "@/components/memories/ongoing-date-photos";

export const metadata: Metadata = { title: "Memories" };

export default async function MemoriesPage() {
  await requireOnboarded();
  const [home, ongoing] = await Promise.all([getMemoryHome(), getOngoingMemoryDates()]);

  if (home.totalCompleted === 0) {
    return (
      <PageContainer className="space-y-6">
        <div className="space-y-4"><PageHeader title="Memories" description="Your private photo journal." /><MemoriesNav /></div>
        <OngoingDatePhotos dates={ongoing} />
        <EmptyState
          icon={<Icon name="images" size="md" />}
          title="The best part comes after the date."
          description="Finish one, keep a few lines and a photo, and your journal opens here — photos first, story attached."
          action={<PlanDateButton />}
        />
      </PageContainer>
    );
  }

  const [feature, ...restRecent] = home.recentMemories;

  return (
    <PageContainer className="min-w-0 space-y-8">
      <div className="space-y-4"><PageHeader title="Memories" description="Your private photo journal." /><MemoriesNav /></div>
      <OngoingDatePhotos dates={ongoing} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat n={home.memoriesKept} label="memories" />
        <Stat n={home.favoriteMemories} label="favourites" />
        <Stat n={home.citiesExplored.length} label="cities" />
        <Stat n={home.bestPhotoCount} label="best photos" />
      </div>

      {home.milestones.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-medium text-ink">Moments</h2>
          <ul className="space-y-2">
            {home.milestones.map(({ item, milestone }) => (
              <li
                key={`${item.id}-${milestone.kind}`}
                className="rounded-xl border border-line bg-surface"
              >
                <div className="border-b border-line px-3 pt-2.5">
                  <MilestoneBadge milestone={milestone} />
                </div>
                <CompactDateCard item={item} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {home.recentMemories.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-medium text-ink">Recent memories</h2>
            <Link href="/memories/timeline" className="shrink-0 whitespace-nowrap py-2 text-sm font-medium text-primary hover:text-primary-hover">
              See all
            </Link>
          </div>
          {feature ? <MemoryDateCard item={feature} eyebrow="Latest" memory /> : null}
          {restRecent.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {restRecent.map((item) => (
                <GridDateCard key={item.id} item={item} memory />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {home.bestPhotos.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-medium text-ink">Best of us</h2>
            <Link href="/memories/photos" className="shrink-0 whitespace-nowrap py-2 text-sm font-medium text-primary hover:text-primary-hover">
              See all
            </Link>
          </div>
          <PhotoWall photos={home.bestPhotos} />
        </section>
      ) : null}

      {home.favoriteDates.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-medium text-ink">Favourite dates</h2>
            <Link href="/memories/favorites" className="shrink-0 whitespace-nowrap py-2 text-sm font-medium text-primary hover:text-primary-hover">
              See all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {home.favoriteDates.map((item) => (
              <GridDateCard key={item.id} item={item} memory />
            ))}
          </div>
        </section>
      ) : null}
    </PageContainer>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface px-3 py-2.5">
      <p className="font-display text-xl font-semibold text-ink">{n}</p><p className="text-xs text-muted">{label}</p>
    </div>
  );
}
