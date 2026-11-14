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
import { SearchInput } from "@/components/ui/search";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsyncTask } from "@/lib/hooks/use-async-task";
import type { TaskState } from "@/lib/state/task";
import { EXPLORE_CATEGORIES } from "@/lib/date/explore-categories";
import { PLACE_CATEGORY_LABEL } from "@/lib/date/place-category";
import { selectPlaceForDateAction } from "@/server/actions/place";
import type { PlaceSearchResult } from "@/server/services/place-search-service";
import { DATE_IDEAS } from "@/lib/explore/date-ideas";
import { addActivityAction } from "@/server/actions/plan";
import type { PlanActivityDTO } from "@/server/services/plan-service";
import { getBrowserLocation } from "@/lib/places/browser-location";
import { NEARBY_RADIUS_KM, type GeoPoint } from "@/lib/places/types";
import { Icon } from "@/components/ui/icon";
import { formatDistanceKm } from "@/lib/utils/geo";

const BROWSE = EXPLORE_CATEGORIES.filter((category) => category.kind === "category" && !["adventure", "nature"].includes(category.key));

export function PlacePickerSheet({
  dateId,
  open,
  onClose,
  categoryKey,
  onCategoryChange,
  activities,
}: {
  dateId: string;
  open: boolean;
  onClose: () => void;
  categoryKey: string | null;
  onCategoryChange: (key: string | null) => void;
  activities: PlanActivityDTO[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [near, setNear] = useState<GeoPoint | null>(null);
  const locationTask = useAsyncTask<GeoPoint, "locating">();
  const { reset: resetLocation } = locationTask;
  const locating = locationTask.state.status === "pending";
  const [search, setSearch] = useState<TaskState<{ key: string; results: PlaceSearchResult[] }>>({ status: "idle" });
  const selectionTask = useAsyncTask<void, "choosing">();
  const { reset: resetSelection } = selectionTask;
  const choosing = selectionTask.state.status === "pending";
  const error = selectionTask.state.status === "error" ? selectionTask.state.message : search.status === "error" ? search.message : null;
  const [retry, setRetry] = useState(0);
  const searchKey = JSON.stringify([q, city, near, categoryKey, retry]);
  const results = search.status === "success" && search.data.key === searchKey ? search.data.results : [];
  const loading = search.status === "pending" || (open && search.status !== "error" && !(search.status === "success" && search.data.key === searchKey));
  const selectedCategory = BROWSE.find((category) => category.key === categoryKey);
  const ideas = selectedCategory ? DATE_IDEAS.filter((idea) => selectedCategory.match.includes(idea.category) &&
    (!q.trim() || `${idea.title} ${idea.blurb}`.toLowerCase().includes(q.trim().toLowerCase()))) : [];
  const ideaTask = useAsyncTask<void, "adding">();
  const busy = choosing || ideaTask.state.status === "pending";

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearch({ status: "pending", phase: "search" });
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (city.trim()) params.set("city", city.trim());
        if (near) { params.set("lat", String(near.latitude)); params.set("lng", String(near.longitude)); }
        if (categoryKey) params.set("category", categoryKey);
        const response = await fetch(`/api/places/search?${params.toString()}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]), cache: "no-store",
        });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { results?: PlaceSearchResult[] };
        if (!controller.signal.aborted) setSearch({ status: "success", data: { key: searchKey, results: data.results ?? [] } });
      } catch {
        if (!controller.signal.aborted) setSearch({ status: "error", phase: "search", message: !navigator.onLine ? "You're offline — reconnect to search." : "Couldn't load places just now." });
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, q, city, near, categoryKey, retry, searchKey]);

  useEffect(() => { if (!open) { resetSelection(); resetLocation(); } }, [open, resetSelection, resetLocation]);

  const locate = async () => {
    const outcome = await locationTask.run("locating", getBrowserLocation);
    if (outcome) { setCity(""); setNear(outcome.data); }
  };

  const choose = async (body: Record<string, string>) => {
    const outcome = await selectionTask.run("choosing", async () => {
      const form = new FormData(); form.set("dateId", dateId);
      for (const [key, value] of Object.entries(body)) form.set(key, value);
      const result = await selectPlaceForDateAction({ status: "idle" }, form);
      if (result.status === "error") throw new Error(result.message);
    });
    if (outcome) { onClose(); router.refresh(); }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Add a place">
      <Tabs defaultValue="find">
        <TabsList>
          <TabsTrigger value="find">Find one</TabsTrigger>
          <TabsTrigger value="custom">Custom place</TabsTrigger>
        </TabsList>

        <TabsContent value="find" className="space-y-3">
          <SearchInput value={q} onValueChange={setQ} placeholder="Venue name, or cafés in your city" />
          <Field label="City or area" htmlFor="place-city" optional>
            <Input id="place-city" value={city} onChange={(event) => { resetLocation(); setNear(null); setCity(event.target.value); }} placeholder="e.g. Jaipur" />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" loading={locating} disabled={busy || locating}
              leadingIcon={<Icon name="mapPin" size="sm" />} onClick={() => void locate()}>
              {locating ? "Finding your location…" : "Use my location"}
            </Button>
            {near ? <Button variant="ghost" size="sm" onClick={() => { resetLocation(); setNear(null); }}>Use city instead</Button> : null}
          </div>
          {near ? <p role="status" className="text-xs text-muted">Using your approximate location · Within {NEARBY_RADIUS_KM} km.</p>
            : <p className="text-xs text-muted">Allow location access to find places near you, or enter a city above.</p>}
          {locationTask.state.status === "error" ? <p role="alert" className="text-sm text-error">{locationTask.state.message}</p> : null}
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
                onClick={() => setRetry((n) => n + 1)}
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
                    {place.imageUrl ? <div className="size-12 shrink-0 overflow-hidden rounded-lg"><PlaceImage src={place.imageUrl} name={place.name} /></div> : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{place.name}</p>
                      <p className="truncate text-xs text-muted">
                        {PLACE_CATEGORY_LABEL[place.category ?? PlaceCategory.OTHER]}
                        {place.city ? ` · ${place.city}` : ""}
                        {place.distanceKm != null ? ` · ${formatDistanceKm(place.distanceKm)}` : ""}
                      </p>
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
