import type { Metadata } from "next";
import Link from "next/link";

import { CompactDateCard } from "@/components/dates/cards/compact-date-card";
import { GridDateCard } from "@/components/dates/cards/grid-date-card";
import { MemoryDateCard } from "@/components/dates/cards/memory-date-card";
import { MemoriesNav } from "@/components/memories/memories-nav";
import { MilestoneBadge } from "@/components/memories/milestone-badge";
import { PhotoWall } from "@/components/memories/photo-wall";
import { PageHeader } from "@/components/layout/page-header";
import { PlanDateButton } from "@/components/navigation/plan-date-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { requireOnboarded } from "@/lib/onboarding";
import { getMemoryHome } from "@/server/services/memory-service";

export const metadata: Metadata = { title: "Memories" };

export default async function MemoriesPage() {
  await requireOnboarded();
  const home = await getMemoryHome();

  if (home.totalCompleted === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Memories" description="Your private photo journal." action={<MemoriesNav />} />
        <EmptyState
          icon={<Icon name="images" size="md" />}
          title="Your journal starts with a date"
          description="Finish a date, keep a memory, and it opens here — photos first, story attached."
          action={<PlanDateButton />}
        />
      </div>
    );
  }

  const [feature, ...restRecent] = home.recentMemories;

  return (
    <div className="space-y-10">
      <PageHeader title="Memories" description="Your private photo journal." action={<MemoriesNav />} />

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
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
            <Link href="/memories/timeline" className="text-sm font-medium text-primary hover:text-primary-hover">
              Full timeline
            </Link>
          </div>
          {feature ? <MemoryDateCard item={feature} eyebrow="Latest" /> : null}
          {restRecent.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {restRecent.map((item) => (
                <GridDateCard key={item.id} item={item} />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {home.bestPhotos.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-medium text-ink">Best of us</h2>
            <Link href="/memories/photos" className="text-sm font-medium text-primary hover:text-primary-hover">
              The whole wall
            </Link>
          </div>
          <PhotoWall photos={home.bestPhotos} />
        </section>
      ) : null}

      {home.favoriteDates.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-medium text-ink">Favourite dates</h2>
            <Link href="/memories/favorites" className="text-sm font-medium text-primary hover:text-primary-hover">
              Our Favourites
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {home.favoriteDates.map((item) => (
              <GridDateCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <span>
      <span className="font-display text-lg font-semibold text-ink">{n}</span> {label}
    </span>
  );
}
