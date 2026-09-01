import type { Metadata } from "next";

import { CategoryRail } from "@/components/explore/category-rail";
import { CustomPlaceForm } from "@/components/explore/custom-place-form";
import { ExploreSearch } from "@/components/explore/explore-search";
import { PlaceCard } from "@/components/explore/place-card";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";
import { exploreCategoryByKey } from "@/lib/date/explore-categories";
import { requireOnboarded } from "@/lib/onboarding";
import { searchPlaces } from "@/server/services/place-search-service";

export const metadata: Metadata = { title: "Explore" };

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; view?: string; forDate?: string }>;
}) {
  await requireOnboarded();
  const { q, category, view, forDate } = await searchParams;
  const suffix = forDate ? `&forDate=${forDate}` : "";

  if (view === "custom") {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader
          title="Add a custom place"
          description="For somewhere a search won't turn up."
          back={{ href: `/explore?${forDate ? `forDate=${forDate}` : ""}`, label: "Explore" }}
        />
        <CustomPlaceForm forDate={forDate} />
      </div>
    );
  }

  const cat = exploreCategoryByKey(category);
  const results = await searchPlaces({
    text: q,
    categories: cat?.kind === "category" ? cat.match : undefined,
    curated: view === "hidden" || cat?.kind === "curated",
  });

  return (
    <div>
      <PageHeader
        title="Explore"
        description={
          forDate
            ? "Pick a place for your date — or add a custom one."
            : "Ideas for your next date, and the places you've saved."
        }
      />

      <div className="space-y-4">
        <ExploreSearch initialQuery={q ?? ""} />
        <CategoryRail activeKey={category} forDate={forDate} />
      </div>

      <div className="mt-6">
        {results.length === 0 ? (
          <EmptyState
            icon={<Icon name="compass" size="md" />}
            title={q || category ? "Nothing matched" : "No saved places yet"}
            description={
              q || category
                ? "Try a different search, or add it as a custom place."
                : "Places you save while planning show up here. You can also add one now."
            }
            action={
              <LinkButton href={`/explore?view=custom${suffix}`}>Add a custom place</LinkButton>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {results.map((place) => (
              <PlaceCard
                key={place.savedPlaceId ?? place.external?.providerPlaceId ?? place.name}
                place={place}
                forDate={forDate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
