import type { Metadata } from "next";

import { CompactDateCard } from "@/components/dates/cards/compact-date-card";
import { GridDateCard } from "@/components/dates/cards/grid-date-card";
import { MemoryDateCard } from "@/components/dates/cards/memory-date-card";
import { TimelineDateCard } from "@/components/dates/cards/timeline-date-card";
import { DatesNav } from "@/components/dates/dates-nav";
import { HistoryControls } from "@/components/dates/history-controls";
import { PageHeader } from "@/components/layout/page-header";
import { PlanDateButton } from "@/components/navigation/plan-date-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";
import { hasActiveFilters, parseHistoryParams } from "@/lib/date/history-filters";
import type { DateHistoryItem } from "@/lib/date/history-item";
import { requireOnboarded } from "@/lib/onboarding";
import { getDateHistory, getHistoryFilterOptions } from "@/server/services/history-service";

export const metadata: Metadata = { title: "Our dates" };

function groupByYear(items: DateHistoryItem[]): { year: string; items: DateHistoryItem[] }[] {
  const groups = new Map<string, DateHistoryItem[]>();
  for (const item of items) {
    const key = item.year ? String(item.year) : "Undated";
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.entries()]
    .sort((a, b) =>
      a[0] === "Undated" ? 1 : b[0] === "Undated" ? -1 : Number(b[0]) - Number(a[0]),
    )
    .map(([year, groupItems]) => ({ year, items: groupItems }));
}

export default async function DatesHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOnboarded();
  const query = parseHistoryParams(await searchParams);

  const [{ items, totalCompleted }, options] = await Promise.all([
    getDateHistory(query),
    getHistoryFilterOptions(),
  ]);

  const narrowed = hasActiveFilters(query) || query.q.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Our dates"
        description="Every date you've finished — the whole story of each one."
        action={<DatesNav />}
      />

      {totalCompleted === 0 ? (
        <EmptyState
          icon={<Icon name="calendarCheck" size="md" />}
          title="No dates yet. Let's make the first one."
          description="Finish a date and it lands here with its photos, scores and memory."
          action={<PlanDateButton />}
        />
      ) : (
        <>
          <HistoryControls query={query} options={options} />

          {items.length === 0 ? (
            <EmptyState
              icon={<Icon name="search" size="md" />}
              title={
                query.q
                  ? `Nothing matches “${query.q}”`
                  : "No dates match those filters"
              }
              description="Loosen the filters or clear them and start again."
              action={
                <LinkButton href="/dates/history" variant="secondary">
                  {query.q && !hasActiveFilters(query) ? "Clear search" : "Clear filters"}
                </LinkButton>
              }
            />
          ) : (
            <HistoryResults items={items} view={query.view} narrowed={narrowed} />
          )}
        </>
      )}
    </div>
  );
}

function HistoryResults({
  items,
  view,
  narrowed,
}: {
  items: DateHistoryItem[];
  view: "timeline" | "grid" | "list";
  narrowed: boolean;
}) {
  const feature = view === "timeline" && !narrowed && items.length > 1 ? items[0] : null;
  const rest = feature ? items.slice(1) : items;

  return (
    <div className="space-y-6">
      {feature ? <MemoryDateCard item={feature} eyebrow="Most recent" /> : null}

      {view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {rest.map((item) => (
            <GridDateCard key={item.id} item={item} />
          ))}
        </div>
      ) : view === "list" ? (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {rest.map((item) => (
            <li key={item.id}>
              <CompactDateCard item={item} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-8">
          {groupByYear(rest).map((group) => (
            <section key={group.year} className="space-y-4">
              <h2 className="font-display text-xs font-semibold uppercase tracking-wide text-muted">
                {group.year}
              </h2>
              <ol className="space-y-5 border-l border-line pl-1">
                {group.items.map((item) => (
                  <TimelineDateCard key={item.id} item={item} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      <p className="pt-1 text-center text-xs text-faint">
        {items.length} {items.length === 1 ? "date" : "dates"}
        {narrowed ? " matched" : ""}
        {items.length >= 250 ? " · showing the 250 most recent — narrow with filters" : ""}
      </p>
    </div>
  );
}
