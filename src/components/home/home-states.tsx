import { MonoMark } from "@/components/layout/logo";
import { PlanDateButton } from "@/components/navigation/plan-date-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";

/** Brand-new couple, zero dates — the emotional first screen. */
export function StoryStartsHere({ coupleName }: { coupleName: string | null }) {
  return (
    <div className="anim-rise mx-auto flex max-w-md flex-col items-center py-10 text-center">
      <MonoMark className="h-10 w-10 text-ink motion-safe:anim-breathe" />
      <h1 className="mt-6 font-display text-3xl font-medium tracking-tight text-ink">
        Your story starts here.
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {coupleName ? `${coupleName} — your` : "Your"} shared space is ready and completely
        private. Plan something, live it, and keep what matters.
      </p>
      <div className="mt-8">
        <PlanDateButton />
      </div>
      <LinkButton href="/explore" variant="link" size="sm" className="mt-4">
        Need ideas? Explore
      </LinkButton>
    </div>
  );
}

/** No upcoming date, but the couple has history — nudge toward the next one. */
export function NoUpcomingState() {
  return (
    <EmptyState
      icon={<Icon name="calendarPlus" size="md" />}
      title="Nothing on the calendar"
      description="Pick a place, set a rough budget, and shape the evening together."
      action={<PlanDateButton />}
    />
  );
}

/** Prominent, above-the-fold call to review a finished date. */
export function PendingReviewBanner({ count }: { count: number }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/25 bg-primary-tint/50 px-4 py-3">
      <Icon name="star" size="sm" className="text-primary" />
      <p className="min-w-0 flex-1 text-sm text-ink">
        {count === 1
          ? "You have a date to look back on."
          : `You have ${count} dates to look back on.`}{" "}
        <span className="text-muted">How was it?</span>
      </p>
      <LinkButton href="/dates?filter=to-review" size="sm">
        Review {count === 1 ? "it" : "them"}
      </LinkButton>
    </div>
  );
}

/** A section's data didn't load — degrade gracefully instead of failing the page. */
export function SectionUnavailable({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface/60 px-4 py-6 text-center text-sm text-muted">
      {label} couldn&apos;t load right now. It&apos;ll be back — nothing was lost.
    </div>
  );
}
