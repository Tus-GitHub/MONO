"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PlaceCategory } from "@prisma/client";

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
import { EXPLORE_CATEGORIES } from "@/lib/date/explore-categories";
import { PLACE_CATEGORY_LABEL } from "@/lib/date/place-category";
import { selectPlaceForDateAction } from "@/server/actions/place";
import type { PlaceSearchResult } from "@/server/services/place-search-service";

const BROWSE = EXPLORE_CATEGORIES.filter((category) => category.kind === "category");

export function PlacePickerSheet({
  dateId,
  open,
  onClose,
}: {
  dateId: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [categoryKey, setCategoryKey] = useState<string | null>(null);
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (categoryKey) params.set("category", categoryKey);
        const response = await fetch(`/api/places/search?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as { results?: PlaceSearchResult[] };
        setResults(data.results ?? []);
      } catch (fetchError) {
        if (!(fetchError instanceof DOMException)) setError("Couldn't load places.");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, q, categoryKey]);

  const choose = async (body: Record<string, string>) => {
    setChoosing(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("dateId", dateId);
      for (const [key, value] of Object.entries(body)) form.set(key, value);
      const result = await selectPlaceForDateAction({ status: "idle" }, form);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      onClose();
      router.refresh();
    } finally {
      setChoosing(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Add a place">
      <Tabs defaultValue="find">
        <TabsList>
          <TabsTrigger value="find">Find one</TabsTrigger>
          <TabsTrigger value="custom">Custom place</TabsTrigger>
        </TabsList>

        <TabsContent value="find" className="space-y-3">
          <SearchInput value={q} onValueChange={setQ} placeholder="Name, area, or activity" />
          <div className="scroll-x no-scrollbar -mx-1 flex gap-2 px-1">
            {BROWSE.map((category) => (
              <Chip
                key={category.key}
                size="sm"
                selected={categoryKey === category.key}
                onClick={() =>
                  setCategoryKey((current) => (current === category.key ? null : category.key))
                }
              >
                {category.label}
              </Chip>
            ))}
          </div>

          {error ? <p className="text-sm text-error">{error}</p> : null}

          {loading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              {q || categoryKey
                ? "Nothing matched. Try the custom tab."
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
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{place.name}</p>
                      <p className="truncate text-xs text-muted">
                        {PLACE_CATEGORY_LABEL[place.category ?? PlaceCategory.OTHER]}
                        {place.city ? ` · ${place.city}` : ""}
                      </p>
                      <div className="mt-1 flex gap-1.5">
                        <PublicRating rating={place.externalRating} count={place.externalRatingCount} />
                        <CoupleScore score10={place.coupleScore10} />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={choosing}
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
        </TabsContent>

        <TabsContent value="custom" className="space-y-3">
          <p className="text-sm text-muted">
            Can&apos;t find it? Add it yourself — you can flesh it out later.
          </p>
          <CustomPlaceForm choosing={choosing} onChoose={choose} error={error} />
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
