import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import type { Comparison } from "@/lib/date/comparison";
import { formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const STORY: Record<Comparison["divergence"], { title: string; line: string }> = {
  "as-planned": {
    title: "It went just how you pictured it",
    line: "Plan and reality lined up — sometimes that's the whole point.",
  },
  adjusted: {
    title: "A few things shifted on the night",
    line: "Mostly the plan, with the odd change of mind. That's how the good ones go.",
  },
  improvised: {
    title: "You wrote your own script",
    line: "Reality took a different turn from the plan — and that's the story worth keeping.",
  },
};

function Lane({
  label,
  planned,
  actual,
  changed,
}: {
  label: string;
  planned: ReactNode;
  actual: ReactNode;
  changed: boolean;
}) {
  return (
    <div className="grid gap-2 py-3 sm:grid-cols-[7rem_1fr] sm:gap-4">
      <p className="text-xs font-medium uppercase tracking-wide text-faint">{label}</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <p className={cn("text-sm", changed ? "text-muted line-through decoration-line-strong" : "text-ink")}>
          {planned}
        </p>
        <Icon
          name="arrowRight"
          size="sm"
          className={cn("hidden sm:block", changed ? "text-primary" : "text-faint")}
        />
        <p className={cn("text-sm", changed ? "font-medium text-ink" : "text-muted")}>
          {actual}
        </p>
      </div>
    </div>
  );
}

function Chips({
  items,
  tone,
  strike = false,
}: {
  items: string[];
  tone: "kept" | "dropped" | "added" | "extra";
  strike?: boolean;
}) {
  if (items.length === 0) return null;
  const cls = {
    kept: "border-line bg-paper text-muted",
    dropped: "border-line bg-paper text-faint line-through",
    added: "border-primary/30 bg-primary-tint text-primary",
    extra: "border-accent/30 bg-accent-tint text-accent",
  }[tone];
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li
          key={item}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs",
            cls,
            strike && "line-through",
          )}
        >
          {tone === "extra" ? <Icon name="sparkles" size={12} /> : null}
          {item}
        </li>
      ))}
    </ul>
  );
}

export function PlanVsReality({
  comparison,
  currency,
}: {
  comparison: Comparison;
  currency: string;
}) {
  const story = STORY[comparison.divergence];
  const { activities, extras, budget } = comparison;

  const budgetDelta =
    budget.deltaCents == null
      ? null
      : budget.deltaCents >= 100
        ? `${formatMoney(budget.deltaCents, currency)} over`
        : budget.deltaCents <= -100
          ? `${formatMoney(-budget.deltaCents, currency)} under`
          : "about right";

  const activitiesChanged = activities.dropped.length > 0 || activities.added.length > 0;

  return (
    <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-accent-tint text-accent">
          <Icon name="heart" size="sm" />
        </span>
        <div>
          <h2 className="font-display text-lg font-medium text-ink">{story.title}</h2>
          <p className="mt-0.5 text-sm text-muted">{story.line}</p>
        </div>
      </div>

      <div className="mt-4 divide-y divide-line border-t border-line">
        <Lane
          label="Time"
          planned={comparison.time.planned ?? "—"}
          actual={comparison.time.actual ?? "not recorded"}
          changed={comparison.time.changed}
        />
        <Lane
          label="Place"
          planned={comparison.place.planned ?? "—"}
          actual={comparison.place.actual ?? "not recorded"}
          changed={comparison.place.changed}
        />
        <Lane
          label="Spend"
          planned={budget.planned != null ? formatMoney(budget.planned, currency) : "—"}
          actual={
            budget.actual != null ? (
              <>
                {formatMoney(budget.actual, currency)}
                {budgetDelta ? <span className="text-faint"> · {budgetDelta}</span> : null}
              </>
            ) : (
              "not recorded"
            )
          }
          changed={budget.changed}
        />

        <div className="grid gap-2 py-3 sm:grid-cols-[7rem_1fr] sm:gap-4">
          <p className="text-xs font-medium uppercase tracking-wide text-faint">What you did</p>
          <div className="space-y-2">
            {!activities.recorded ? (
              <p className="text-sm text-faint">Not recorded.</p>
            ) : (
              <>
                {!activitiesChanged && activities.kept.length > 0 ? (
                  <p className="text-sm text-muted">Everything you planned, you did.</p>
                ) : null}
                <Chips items={activities.kept} tone="kept" />
                {activities.dropped.length > 0 ? (
                  <div>
                    <p className="mb-1 text-2xs uppercase tracking-wide text-faint">Skipped</p>
                    <Chips items={activities.dropped} tone="dropped" />
                  </div>
                ) : null}
                {activities.added.length > 0 ? (
                  <div>
                    <p className="mb-1 text-2xs uppercase tracking-wide text-faint">
                      Added on the day
                    </p>
                    <Chips items={activities.added} tone="added" />
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        {extras.length > 0 ? (
          <div className="grid gap-2 py-3 sm:grid-cols-[7rem_1fr] sm:gap-4">
            <p className="text-xs font-medium uppercase tracking-wide text-faint">
              Extra experiences
            </p>
            <div className="space-y-1.5">
              <p className="text-sm text-muted">Detours and stops that were never in the plan:</p>
              <Chips items={extras} tone="extra" />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
