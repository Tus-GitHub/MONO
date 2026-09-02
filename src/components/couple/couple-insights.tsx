import { Icon } from "@/components/ui/icon";
import type { CoupleInsight } from "@/lib/couple/insights";

export function CoupleInsights({ insights }: { insights: CoupleInsight[] }) {
  if (insights.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium text-ink">What the data says</h2>
        <p className="rounded-xl border border-dashed border-line bg-surface/60 px-4 py-6 text-center text-sm text-muted">
          A few more completed dates and patterns will start to show — favourite places, best
          value nights, the activities you keep coming back to.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-medium text-ink">What the data says</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {insights.map((insight) => (
          <li
            key={insight.key}
            className="flex gap-3 rounded-xl border border-line bg-surface p-4"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-tint text-accent">
              <Icon name={insight.icon} size="sm" />
            </span>
            <div className="min-w-0">
              <p className="text-2xs font-medium uppercase tracking-wide text-faint">
                {insight.label}
              </p>
              <p className="mt-0.5 text-sm text-ink">{insight.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-2xs text-faint">
        Every line here is a plain count or average over your own dates — nothing is predicted.
      </p>
    </section>
  );
}
