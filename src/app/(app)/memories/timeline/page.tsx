import type { Metadata } from "next";

import { MemoriesNav } from "@/components/memories/memories-nav";
import { MemoryTimelineItem } from "@/components/memories/memory-timeline-item";
import { PageHeader } from "@/components/layout/page-header";
import { PlanDateButton } from "@/components/navigation/plan-date-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";
import { requireOnboarded } from "@/lib/onboarding";
import { getMemoryTimeline, type MemoryTimelineItem as TimelineItem } from "@/server/services/memory-service";

export const metadata: Metadata = { title: "Timeline" };

function groupByYear(items: TimelineItem[]): { year: string; items: TimelineItem[] }[] {
  const groups = new Map<string, TimelineItem[]>();
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

export default async function MemoryTimelinePage() {
  await requireOnboarded();
  const { items, totalCompleted, citiesExplored } = await getMemoryTimeline();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timeline"
        description="Every kept memory in order — the whole story, newest first."
        action={<MemoriesNav />}
      />

      {totalCompleted === 0 ? (
        <EmptyState
          icon={<Icon name="calendarCheck" size="md" />}
          title="The timeline starts with your first date"
          description="Finish a date and keep a memory — it takes its place here."
          action={<PlanDateButton />}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Icon name="images" size="md" />}
          title="No memories kept yet"
          description="You've finished dates — turn one into a memory and it opens the timeline."
          action={
            <LinkButton href="/dates" variant="secondary">
              Our dates
            </LinkButton>
          }
        />
      ) : (
        <>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            <span>
              <span className="font-display text-lg font-semibold text-ink">{items.length}</span>{" "}
              {items.length === 1 ? "memory" : "memories"}
            </span>
            {citiesExplored.length > 0 ? (
              <span>
                <span className="font-display text-lg font-semibold text-ink">
                  {citiesExplored.length}
                </span>{" "}
                {citiesExplored.length === 1 ? "city" : "cities"} explored
              </span>
            ) : null}
          </p>

          <div className="space-y-8">
            {groupByYear(items).map((group) => (
              <section key={group.year} className="space-y-4">
                <h2 className="font-display text-xs font-semibold uppercase tracking-wide text-muted">
                  {group.year}
                </h2>
                <ol className="space-y-6 border-l border-line pl-1">
                  {group.items.map((item) => (
                    <MemoryTimelineItem
                      key={item.id}
                      item={item}
                      ordinal={item.ordinal}
                      milestones={item.milestones}
                    />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
