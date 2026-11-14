import { PendingFields } from "@/components/forms/pending-fields";
import type { Metadata } from "next";
import Link from "@/components/ui/app-link";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { SubmitButton } from "@/components/ui/submit-button";
import { planStepHref } from "@/lib/date/plan-steps";
import { requireOnboarded } from "@/lib/onboarding";
import { formatWallDate, relativeTime } from "@/lib/utils/format";
import { startPlanAction } from "@/server/actions/plan";
import { listDrafts } from "@/server/services/plan-service";

export const metadata: Metadata = { title: "Plan a date" };

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ place?: string; idea?: string }>;
}) {
  await requireOnboarded();
  const { place, idea } = await searchParams;
  const drafts = await listDrafts();

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Plan a date"
        description="Plan on this device first. A shared date or draft is created only when you choose Save."
      />

      <form action={startPlanAction}>
        <PendingFields>
          {place ? <input type="hidden" name="place" value={place} /> : null}
          {idea ? <input type="hidden" name="idea" value={idea} /> : null}
          <SubmitButton size="lg" fullWidth leadingIcon={<Icon name="plus" size="sm" />}>
            Start a new plan
          </SubmitButton>
        </PendingFields>
      </form>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-medium text-ink">Saved drafts</h2>
        {drafts.length === 0 ? (
          <EmptyState
            icon={<Icon name="pencil" size="md" />}
            title="Nothing half-planned right now"
            description="Start above. Your new plan stays on this device until you choose Save."
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <Link
                  href={planStepHref(draft.id, "basics")}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-paper/70"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-tint text-primary">
                    <Icon name="calendarPlus" size="sm" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {draft.title || "Untitled plan"}
                    </span>
                    <span className="block text-xs text-muted">
                      {draft.date ? `${formatWallDate(draft.date, "medium")} · ` : ""}
                      {draft.activityCount} {draft.activityCount === 1 ? "activity" : "activities"} ·
                      edited {relativeTime(draft.updatedAt)}
                    </span>
                  </span>
                  <Icon name="chevronRight" size="sm" className="text-faint" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
