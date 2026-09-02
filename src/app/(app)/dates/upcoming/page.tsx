import type { Metadata } from "next";
import Link from "next/link";

import { DatesNav } from "@/components/dates/dates-nav";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { PlanDateButton } from "@/components/navigation/plan-date-button";
import { UpcomingList, type UpcomingItem } from "@/components/dates/upcoming-list";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { requireOnboarded } from "@/lib/onboarding";
import { getUpcomingDates } from "@/server/services/date-service";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Upcoming dates" };

export default async function UpcomingDatesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  await requireOnboarded();
  const { sort: rawSort } = await searchParams;
  const sort = rawSort === "latest" ? "latest" : "soonest";
  const dates = await getUpcomingDates(sort);

  const items: UpcomingItem[] = dates.map((date) => ({
    id: date.id,
    title: date.title || "Untitled date",
    status: date.status,
    scheduledForIso: date.scheduledFor?.toISOString() ?? null,
    startIso: date.plannedStartAt?.toISOString() ?? null,
    placeLabel: date.plannedPlace
      ? `${date.plannedPlace.name}${date.plannedPlace.city ? `, ${date.plannedPlace.city}` : ""}`
      : null,
    activities: date.activities.map((activity) => activity.title),
    activityCount: date._count.activities,
    expectedBudgetCents: date.expectedBudgetCents,
    currency: date.currency,
  }));

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Upcoming dates"
        description="Everything that's still ahead of you."
        action={<DatesNav />}
      />

      {items.length > 0 ? (
        <div className="flex justify-end">
          <div className="flex rounded-lg border border-line p-0.5 text-xs font-medium">
            {(["soonest", "latest"] as const).map((option) => (
              <Link
                key={option}
                href={`/dates/upcoming?sort=${option}`}
                className={cn(
                  "rounded-md px-2.5 py-1 capitalize transition-colors",
                  sort === option ? "bg-primary text-primary-fg" : "text-muted hover:text-ink",
                )}
              >
                {option}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={<Icon name="calendarPlus" size="md" />}
          title="Nothing coming up"
          description="Plan a date and it'll show up here with a countdown."
          action={<PlanDateButton />}
        />
      ) : (
        <UpcomingList items={items} />
      )}
    </PageContainer>
  );
}
