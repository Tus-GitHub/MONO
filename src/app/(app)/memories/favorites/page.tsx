import type { Metadata } from "next";
import Link from "next/link";

import { GridDateCard } from "@/components/dates/cards/grid-date-card";
import { MemoriesNav } from "@/components/memories/memories-nav";
import { PhotoWall } from "@/components/memories/photo-wall";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";
import { requireOnboarded } from "@/lib/onboarding";
import { getFavorites } from "@/server/services/memory-service";

export const metadata: Metadata = { title: "Our Favourites" };

export default async function FavoritesPage() {
  await requireOnboarded();
  const { dates, photos, places } = await getFavorites();
  const nothing = dates.length === 0 && photos.length === 0 && places.length === 0;

  return (
    <PageContainer className="space-y-10">
      <PageHeader
        title="Our Favourites"
        description="The dates, photos and places you keep coming back to."
        action={<MemoriesNav />}
      />

      {nothing ? (
        <EmptyState
          icon={<Icon name="heart" size="md" />}
          title="Nothing marked a favourite yet"
          description="Tap the heart on a memory, a photo on the wall, or a place — they gather here."
          action={
            <LinkButton href="/memories" variant="secondary">
              Back to the journal
            </LinkButton>
          }
        />
      ) : null}

      {dates.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-medium text-ink">Favourite dates</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {dates.map((item) => (
              <GridDateCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {photos.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-medium text-ink">Favourite photos</h2>
          <PhotoWall photos={photos} favoritable />
        </section>
      ) : null}

      {places.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-medium text-ink">Favourite places</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {places.map((place) => (
              <li key={place.id}>
                <Link
                  href={`/places/${place.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-paper/70"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-tint text-primary">
                    <Icon name="heart" size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{place.name}</p>
                    <p className="truncate text-xs text-muted">
                      {[place.categoryLabel, place.city].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-faint">
                    {place.visitCount} {place.visitCount === 1 ? "date" : "dates"}
                  </span>
                  <Icon name="chevronRight" size="sm" className="shrink-0 text-faint" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PageContainer>
  );
}
