"use client";

import { useState, type ReactNode } from "react";
import type { RecommendationSignal } from "@prisma/client";
import Link from "@/components/ui/app-link";
import { PlaceCard } from "./place-card";
import { VenueSearchControls } from "@/components/places/venue-search-controls";
import { PlaceAttribution } from "@/components/places/place-attribution";
import { useVenueSearch } from "@/lib/hooks/use-venue-search";
import { EXPLORE_CATEGORIES } from "@/lib/date/explore-categories";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function ExploreDiscovery({ initialQuery, initialCategory, forDate, feedback, children }: {
  initialQuery: string; initialCategory: string | null; forDate?: string;
  feedback: Record<string, RecommendationSignal>; children?: ReactNode;
}) {
  const [categoryKey, setCategory] = useState(initialCategory);
  const search = useVenueSearch({ categoryKey, initialQuery });
  const browsingSaved = !search.q.trim() && !search.city.trim() && !search.near;
  return <div className="space-y-5">
    <VenueSearchControls search={search} />
    <div className="scroll-x no-scrollbar -mx-4 flex gap-2.5 px-4 sm:mx-0 sm:px-0" role="group" aria-label="Venue categories">
      <Button className="h-auto w-20 shrink-0" variant={!categoryKey ? "secondary" : "ghost"} aria-pressed={!categoryKey} onClick={() => setCategory(null)}>All</Button>
      {EXPLORE_CATEGORIES.filter((category) => category.kind === "category").map((category) => <button
        key={category.key} type="button" aria-pressed={categoryKey === category.key} onClick={() => setCategory(category.key)}
        className={cn("flex w-20 shrink-0 flex-col items-center gap-2 rounded-xl border p-3 text-center", categoryKey === category.key ? "border-primary bg-primary-tint/40" : "border-line bg-surface")}>
        <span className={cn("grid size-9 place-items-center rounded-lg", category.tint)}><Icon name={category.icon} size="sm" /></span>
        <span className="text-2xs font-medium text-ink">{category.label}</span>
      </button>)}
    </div>
    <div className="flex flex-wrap gap-4 text-xs text-primary">
      <Link href={`/explore?view=hidden${forDate ? `&forDate=${forDate}` : ""}`}>Hidden gems</Link>
      <Link href={`/explore?view=custom${forDate ? `&forDate=${forDate}` : ""}`}>Add a custom place</Link>
    </div>
    <div><h2 className="font-display text-lg text-ink">{browsingSaved ? "Your saved places" : "Matching places"}</h2>
      <p className="text-sm text-muted">{browsingSaved
        ? "These are saved places, not a selected city. Choose a city or use your location to discover more venues."
        : "Each outlet is listed separately. Check its address and distance before choosing."}</p></div>
    {search.loading ? <div className="flex justify-center py-8"><Spinner /></div>
      : search.error ? <p role="alert" className="text-sm text-error">{search.error} <Button variant="link" onClick={search.retry}>Try again</Button></p>
      : !search.results.length ? <p className="py-6 text-sm text-muted">{browsingSaved ? "No saved places in this category yet. Enter a city or venue name above." : "No matches found. Try a wider radius, another category, or a different city."}</p>
      : <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{search.results.map((place) => <PlaceCard
        key={place.savedPlaceId ?? `${place.external?.provider}:${place.external?.providerPlaceId}`} place={place} forDate={forDate}
        feedbackSignal={place.savedPlaceId ? feedback[`PLACE:${place.savedPlaceId}`] ?? null : null} />)}</div>}
    <PlaceAttribution provider={search.results.some((place) => place.external?.provider === "photon") ? "photon" : null} />
    {browsingSaved && !categoryKey ? children : null}
  </div>;
}
