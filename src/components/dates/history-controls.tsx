"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PLACE_CATEGORY_LABEL } from "@/lib/date/place-category";
import { REVISIT_CHOICE_META } from "@/lib/date/revisit-choice";
import {
  hasActiveFilters,
  historyParamsToString,
  SCORE_BUCKETS,
  type HistoryQuery,
  type HistoryView,
} from "@/lib/date/history-filters";
import type { HistoryFilterOptions } from "@/server/services/history-service";
import { cn } from "@/lib/utils/cn";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const VIEWS: { value: HistoryView; label: string }[] = [
  { value: "timeline", label: "Timeline" },
  { value: "grid", label: "Grid" },
  { value: "list", label: "List" },
];

export function HistoryControls({
  query,
  options,
}: {
  query: HistoryQuery;
  options: HistoryFilterOptions;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Debounced search, kept in sync with the URL.
  const [term, setTerm] = useState(query.q);
  const [lastQ, setLastQ] = useState(query.q);
  if (query.q !== lastQ) {
    setLastQ(query.q);
    setTerm(query.q);
  }

  const push = (next: Partial<HistoryQuery>) => {
    const merged = { ...query, ...next };
    router.replace(`${pathname}${historyParamsToString(merged)}`, { scroll: false });
  };

  useEffect(() => {
    if (term.trim() === query.q) return;
    const id = setTimeout(() => {
      router.replace(
        `${pathname}${historyParamsToString({ ...query, q: term.trim() || undefined })}`,
        { scroll: false },
      );
    }, 350);
    return () => clearTimeout(id);
  }, [term, query, pathname, router]);

  const activeFilters = hasActiveFilters(query);
  const filterCount = [
    query.year,
    query.month,
    query.category,
    query.placeId,
    query.city,
    query.activity,
    query.revisit,
    query.minScore,
  ].filter(Boolean).length;

  const chips: { label: string; clear: Partial<HistoryQuery> }[] = [];
  if (query.year) chips.push({ label: String(query.year), clear: { year: undefined } });
  if (query.month) chips.push({ label: MONTHS[query.month - 1], clear: { month: undefined } });
  if (query.category)
    chips.push({ label: PLACE_CATEGORY_LABEL[query.category], clear: { category: undefined } });
  if (query.placeId) {
    const name = options.places.find((p) => p.id === query.placeId)?.name ?? "Place";
    chips.push({ label: name, clear: { placeId: undefined } });
  }
  if (query.city) chips.push({ label: query.city, clear: { city: undefined } });
  if (query.activity) chips.push({ label: `“${query.activity}”`, clear: { activity: undefined } });
  if (query.revisit)
    chips.push({
      label: REVISIT_CHOICE_META[query.revisit].short,
      clear: { revisit: undefined },
    });
  if (query.minScore)
    chips.push({ label: `${query.minScore}+`, clear: { minScore: undefined } });

  const clearAll = () =>
    push({
      year: undefined,
      month: undefined,
      category: undefined,
      placeId: undefined,
      city: undefined,
      activity: undefined,
      revisit: undefined,
      minScore: undefined,
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Icon
            name="search"
            size="sm"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search titles, places, memories…"
            aria-label="Search date history"
            className="pl-9"
          />
          {term ? (
            <button
              type="button"
              onClick={() => setTerm("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 grid size-6 place-items-center rounded text-muted hover:text-ink"
            >
              <Icon name="x" size={14} />
            </button>
          ) : null}
        </div>

        <div className="inline-flex rounded-lg border border-line p-0.5 text-xs font-medium">
          {VIEWS.map((view) => (
            <button
              key={view.value}
              type="button"
              onClick={() => push({ view: view.value })}
              className={cn(
                "rounded-md px-2.5 py-1.5 transition-colors",
                query.view === view.value
                  ? "bg-primary text-primary-fg"
                  : "text-muted hover:text-ink",
              )}
            >
              {view.label}
            </button>
          ))}
        </div>

        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => setFiltersOpen(true)}
          leadingIcon={<Icon name="filter" size="sm" />}
        >
          Filters{filterCount > 0 ? ` · ${filterCount}` : ""}
        </Button>
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <Chip key={chip.label} size="sm" onClick={() => push(chip.clear)} onRemove={() => push(chip.clear)}>
              {chip.label}
            </Chip>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-medium text-muted transition-colors hover:text-ink"
          >
            Clear all
          </button>
        </div>
      ) : null}

      <BottomSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filter your dates"
        footer={
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={clearAll}
              disabled={!activeFilters}
              className="text-sm font-medium text-muted transition-colors hover:text-ink disabled:opacity-40"
            >
              Clear all
            </button>
            <Button type="button" onClick={() => setFiltersOpen(false)}>
              Done
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Year" htmlFor="f-year">
              <Select
                id="f-year"
                value={query.year ?? ""}
                onChange={(event) =>
                  push({ year: event.target.value ? Number(event.target.value) : undefined })
                }
              >
                <option value="">Any year</option>
                {options.years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Month" htmlFor="f-month">
              <Select
                id="f-month"
                value={query.month ?? ""}
                onChange={(event) =>
                  push({ month: event.target.value ? Number(event.target.value) : undefined })
                }
              >
                <option value="">Any month</option>
                {MONTHS.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {options.categories.length > 0 ? (
            <Field label="Kind of place" htmlFor="f-category">
              <Select
                id="f-category"
                value={query.category ?? ""}
                onChange={(event) =>
                  push({
                    category: event.target.value
                      ? (event.target.value as HistoryQuery["category"])
                      : undefined,
                  })
                }
              >
                <option value="">Any kind</option>
                {options.categories.map((category) => (
                  <option key={category} value={category}>
                    {PLACE_CATEGORY_LABEL[category]}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          {options.places.length > 0 ? (
            <Field label="Place" htmlFor="f-place">
              <Select
                id="f-place"
                value={query.placeId ?? ""}
                onChange={(event) => push({ placeId: event.target.value || undefined })}
              >
                <option value="">Anywhere</option>
                {options.places.map((place) => (
                  <option key={place.id} value={place.id}>
                    {place.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          {options.cities.length > 0 ? (
            <Field label="City" htmlFor="f-city">
              <Select
                id="f-city"
                value={query.city ?? ""}
                onChange={(event) => push({ city: event.target.value || undefined })}
              >
                <option value="">Any city</option>
                {options.cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <Field label="Activity" htmlFor="f-activity" hint="Matches what you did or planned">
            <Input
              id="f-activity"
              defaultValue={query.activity}
              onChange={(event) => push({ activity: event.target.value.trim() || undefined })}
              placeholder="e.g. karaoke, hiking"
            />
          </Field>

          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Couple score</p>
            <div className="flex flex-wrap gap-1.5">
              {SCORE_BUCKETS.map((bucket) => (
                <Chip
                  key={bucket.label}
                  size="sm"
                  selected={(query.minScore ?? null) === bucket.value}
                  onClick={() => push({ minScore: bucket.value ?? undefined })}
                >
                  {bucket.label}
                </Chip>
              ))}
            </div>
          </div>

          {options.revisits.length > 0 ? (
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Would you go again?</p>
              <div className="flex flex-wrap gap-1.5">
                {options.revisits.map((choice) => (
                  <Chip
                    key={choice}
                    size="sm"
                    selected={query.revisit === choice}
                    onClick={() =>
                      push({ revisit: query.revisit === choice ? undefined : choice })
                    }
                  >
                    {REVISIT_CHOICE_META[choice].label}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </BottomSheet>
    </div>
  );
}
