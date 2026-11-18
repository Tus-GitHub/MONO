import { AmorMark } from "@/components/layout/logo";
import { PlanDateButton } from "@/components/navigation/plan-date-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";

/** Brand-new couple, zero dates — the emotional first screen. */
export function StoryStartsHere({ coupleName }: { coupleName: string | null }) {
  return (
    <div className="anim-rise relative mx-auto flex max-w-lg flex-col items-center overflow-hidden rounded-2xl border border-line bg-linear-to-br from-primary-tint/40 via-surface to-accent-tint/30 px-6 py-10 text-center shadow-sm sm:px-8 sm:py-12">
      <div className="grid size-16 place-items-center rounded-2xl border border-line bg-surface px-2 shadow-xs">
        <AmorMark className="h-9 w-12 text-ink motion-safe:anim-breathe" />
      </div>
      <h1 className="mt-6 font-display text-3xl font-medium tracking-tight text-ink">
        Your story starts here.
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
        {coupleName ? `${coupleName} — your` : "Your"} shared space is ready and completely
        private. Plan something, live it, and keep what matters.
      </p>

      <div className="mt-6 grid w-full grid-cols-3 gap-2 text-left">
        <div className="rounded-xl border border-line bg-surface/85 p-3">
          <span className="text-2xs font-semibold uppercase tracking-wider text-primary">1. Plan</span>
          <p className="mt-1 text-xs text-muted">Pick stops, time &amp; budget</p>
        </div>
        <div className="rounded-xl border border-line bg-surface/85 p-3">
          <span className="text-2xs font-semibold uppercase tracking-wider text-accent">2. Live</span>
          <p className="mt-1 text-xs text-muted">Capture photos &amp; detours</p>
        </div>
        <div className="rounded-xl border border-line bg-surface/85 p-3">
          <span className="text-2xs font-semibold uppercase tracking-wider text-success">3. Keep</span>
          <p className="mt-1 text-xs text-muted">Blind-rate &amp; save memories</p>
        </div>
      </div>

      <div className="mt-7">
        <PlanDateButton />
      </div>
      <LinkButton href="/explore" variant="link" size="sm" className="mt-3">
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
      <LinkButton href="/dates/history?filter=to-review" size="sm">
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
