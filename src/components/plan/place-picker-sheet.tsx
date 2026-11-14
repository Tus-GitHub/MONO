"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PlaceCategory } from "@prisma/client";
import { PlaceAttribution } from "@/components/places/place-attribution";
import { PhotoCredit } from "@/components/places/photo-credit";
import { PlaceImage } from "@/components/places/place-image";

import { CoupleScore, PublicRating } from "@/components/explore/rating-badges";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsyncTask } from "@/lib/hooks/use-async-task";
import { EXPLORE_CATEGORIES } from "@/lib/date/explore-categories";
import { PLACE_CATEGORY_LABEL } from "@/lib/date/place-category";
import { selectPlaceForDateAction } from "@/server/actions/place";
import { DATE_IDEAS } from "@/lib/explore/date-ideas";
import { addActivityAction } from "@/server/actions/plan";
import type { PlanActivityDTO } from "@/server/services/plan-service";
import { formatDistanceKm } from "@/lib/utils/geo";
import { useVenueSearch } from "@/lib/hooks/use-venue-search";
import { VenueSearchControls } from "@/components/places/venue-search-controls";
import { selectPlaceSchema } from "@/lib/validation/place";
import type { LocalPlaceChoice } from "@/lib/validation/new-plan";

const BROWSE = EXPLORE_CATEGORIES.filter((category) => category.kind === "category" && !["adventure", "nature"].includes(category.key));

export function PlacePickerSheet({
  dateId,
  open,
  onClose,
  categoryKey,
  onCategoryChange,
  activities,
  onChooseLocal,
  onAddLocalIdea,
}: {
  dateId?: string;
  open: boolean;
  onClose: () => void;
  categoryKey: string | null;
  onCategoryChange: (key: string | null) => void;
  activities: PlanActivityDTO[];
  onChooseLocal?: (place: LocalPlaceChoice) => void;
  onAddLocalIdea?: (title: string) => void;
}) {
  const router = useRouter();
  const search = useVenueSearch({ active: open, categoryKey });
  const { q, setQ, city, near, results, loading } = search;
  const selectionTask = useAsyncTask<void, "choosing">();
  const { reset: resetSelection } = selectionTask;
  const choosing = selectionTask.state.status === "pending";
  const error = selectionTask.state.status === "error" ? selectionTask.state.message : search.error ?? null;
  const selectedCategory = BROWSE.find((category) => category.key === categoryKey);
  const ideas = selectedCategory ? DATE_IDEAS.filter((idea) => selectedCategory.match.includes(idea.category) &&
    (!q.trim() || `${idea.title} ${idea.blurb}`.toLowerCase().includes(q.trim().toLowerCase()))) : [];
  const ideaTask = useAsyncTask<void, "adding">();
  const busy = choosing || ideaTask.state.status === "pending";

  useEffect(() => { if (!open) resetSelection(); }, [open, resetSelection]);
  // Keep the selected area, but don't carry a café's name into the next event's search.
  useEffect(() => { if (!open) setQ(""); }, [open, setQ]);

  const choose = async (body: Record<string, string>) => {
    const outcome = await selectionTask.run("choosing", async () => {
      if (onChooseLocal) {
        const match = results.find((place) => body.mode === "saved" ? place.savedPlaceId === body.savedPlaceId
          : body.mode === "external" ? place.external?.providerPlaceId === body.providerPlaceId : false);
        if (!match && body.mode !== "custom") throw new Error("Search again before choosing that place.");
        onChooseLocal({ selection: selectPlaceSchema.parse(body), name: match?.name ?? body.name,
          city: match?.city ?? body.city ?? null, address: match?.address ?? null, imageUrl: match?.imageUrl ?? null });
        return;
      }
      if (!dateId) throw new Error("Open a date plan first.");
      const form = new FormData(); form.set("dateId", dateId);
      for (const [key, value] of Object.entries(body)) form.set(key, value);
      const result = await selectPlaceForDateAction({ status: "idle" }, form);
      if (result.status === "error") throw new Error(result.message);
    });
    if (outcome) { onClose(); if (!onChooseLocal) router.refresh(); }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Add a place">
      <Tabs defaultValue="find">
        <TabsList>
          <TabsTrigger value="find">Find one</TabsTrigger>
          <TabsTrigger value="custom">Custom place</TabsTrigger>
        </TabsList>

        <TabsContent value="find" className="space-y-3">
          <VenueSearchControls search={search} disabled={busy} />
          <div className="scroll-x no-scrollbar -mx-1 flex gap-2 px-1">
            <Chip size="sm" selected={!categoryKey} onClick={() => onCategoryChange(null)}>All</Chip>
            {BROWSE.map((category) => (
              <Chip
                key={category.key}
                size="sm"
                selected={categoryKey === category.key}
                onClick={() =>
                  onCategoryChange(categoryKey === category.key ? null : category.key)
                }
              >
                {category.label}
              </Chip>
            ))}
          </div>

          {ideas.length > 0 ? <section className="space-y-2" aria-label="Matching date ideas">
            <h3 className="text-sm font-medium text-ink">{PLACE_CATEGORY_LABEL[selectedCategory?.match[0] ?? PlaceCategory.OTHER]} ideas</h3>
            <p className="text-xs text-muted">Add an idea to your plan. Choose a real venue separately below.</p>
            <ul className="space-y-2">{ideas.map((idea) => {
              const added = activities.some((activity) => activity.title.toLowerCase() === idea.title.toLowerCase());
              return <li key={idea.key} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3">
                <div className="min-w-0 flex-1"><p className="text-sm font-medium text-ink">{idea.title}</p><p className="text-xs text-muted">{idea.blurb}</p></div>
                <Button size="sm" variant="secondary" disabled={busy || added} aria-label={`${added ? "Added" : "Add"} ${idea.title}`}
                  onClick={() => void ideaTask.run("adding", async () => {
                    if (onAddLocalIdea) { onAddLocalIdea(idea.title); return; }
                    if (!dateId) throw new Error("Open a date plan first.");
                    const form = new FormData(); form.set("dateId", dateId); form.set("title", idea.title);
                    const result = await addActivityAction({ status: "idle" }, form);
                    if (result.status === "error") throw new Error(result.message);
                  })}>{added ? "Added" : "Add to plan"}</Button>
              </li>;
            })}</ul>
            {ideaTask.state.status === "error" ? <p role="alert" className="text-sm text-error">{ideaTask.state.message}</p> : null}
          </section> : null}

          <h3 className="text-sm font-medium text-ink">{selectedCategory ? `${PLACE_CATEGORY_LABEL[selectedCategory.match[0]]} places` : "Places"}</h3>
          {categoryKey && !q.trim() && !city.trim() && !near ? <p className="text-xs text-muted">Showing saved places. Enter a city or use your location to find more matching venues.</p> : null}

          {error ? (
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-error">
              {error}
              <button
                type="button"
                onClick={search.retry}
                className="font-medium underline underline-offset-2"
              >
                Try again
              </button>
            </p>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              {q || city || near || categoryKey
                ? "No matching places found. Try another city or search, or add a custom place."
                : "Search your saved places, or add a custom one."}
            </p>
          ) : (
            <ul className="space-y-2">
              {results.map((place) => {
                const key = place.savedPlaceId ?? `${place.external?.providerPlaceId}`;
                return (
                  <li
                    key={key}
                    className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3"
                  >
                    {place.imageUrl ? <div className="size-20 shrink-0 overflow-hidden rounded-lg"><PlaceImage src={place.imageUrl} name={place.name} /></div> : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{place.name}</p>
                      <p className="truncate text-xs text-muted">
                        {PLACE_CATEGORY_LABEL[place.category ?? PlaceCategory.OTHER]}
                        {place.city ? ` · ${place.city}` : ""}
                        {place.distanceKm != null ? ` · ${formatDistanceKm(place.distanceKm)}` : ""}
                      </p>
                      {place.address ? <p className="line-clamp-2 text-xs text-muted">{place.address}</p> : null}
                      <div className="mt-1 flex gap-1.5">
                        <PublicRating rating={place.externalRating} count={place.externalRatingCount} />
                        <CoupleScore score10={place.coupleScore10} />
                      </div>
                      <PhotoCredit photo={place.photo} />
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        choose(
                          place.savedPlaceId
                            ? { mode: "saved", savedPlaceId: place.savedPlaceId }
                            : {
                              mode: "external",
                              provider: place.external!.provider,
                              providerPlaceId: place.external!.providerPlaceId,
                            },
                        )
                      }
                    >
                      Choose
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          <PlaceAttribution provider={results.some((place) => place.external?.provider === "photon") ? "photon" : null} />
        </TabsContent>

        <TabsContent value="custom" className="space-y-3">
          <p className="text-sm text-muted">
            Can&apos;t find it? Add it yourself — you can flesh it out later.
          </p>
          <CustomPlaceForm choosing={busy} onChoose={choose} error={error} />
        </TabsContent>
      </Tabs>
    </BottomSheet>
  );
}

function CustomPlaceForm({
  choosing,
  onChoose,
  error,
}: {
  choosing: boolean;
  onChoose: (body: Record<string, string>) => void;
  error: string | null;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<PlaceCategory>(PlaceCategory.OTHER);
  const [city, setCity] = useState("");

  return (
    <div className="space-y-3">
      <Field label="Name" htmlFor="cp-name">
        <Input id="cp-name" value={name} onChange={(event) => setName(event.target.value)} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category" htmlFor="cp-category">
          <Select
            id="cp-category"
            value={category}
            onChange={(event) => setCategory(event.target.value as PlaceCategory)}
          >
            {Object.values(PlaceCategory).map((value) => (
              <option key={value} value={value}>
                {PLACE_CATEGORY_LABEL[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="City" htmlFor="cp-city" optional>
          <Input id="cp-city" value={city} onChange={(event) => setCity(event.target.value)} />
        </Field>
      </div>
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <Button
        disabled={!name.trim() || choosing}
        onClick={() =>
          onChoose({ mode: "custom", name: name.trim(), category, ...(city.trim() ? { city: city.trim() } : {}) })
        }
      >
        Use this place
      </Button>
    </div>
  );
}
