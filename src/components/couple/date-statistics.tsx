import Link from "next/link";

import { Icon, type IconName } from "@/components/ui/icon";
import { formatMoney, formatWallDate } from "@/lib/utils/format";
import type { DateStatistics as Stats, RatedDateRef } from "@/server/services/couple-insights-service";

function Stat({
  icon,
  value,
  label,
  hint,
}: {
  icon: IconName;
  value: string | number;
  label: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <span className="grid size-8 place-items-center rounded-lg bg-primary-tint text-primary">
        <Icon name={icon} size="sm" />
      </span>
      <p className="mt-3 font-display text-xl font-semibold text-ink">{value}</p>
      <p className="text-xs text-muted">{label}</p>
      {hint ? <p className="mt-0.5 text-2xs text-faint">{hint}</p> : null}
    </div>
  );
}

function RatedRow({ tone, item }: { tone: "high" | "low"; item: RatedDateRef }) {
  return (
    <Link
      href={`/dates/${item.id}`}
      className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3.5 py-2.5 transition-colors hover:border-line-strong"
    >
      <span
        className={
          tone === "high"
            ? "grid size-8 place-items-center rounded-lg bg-success-tint text-success"
            : "grid size-8 place-items-center rounded-lg bg-line text-muted"
        }
      >
        <Icon name={tone === "high" ? "star" : "chevronDown"} size="sm" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{item.title}</p>
        <p className="truncate text-xs text-muted">
          {tone === "high" ? "Highest rated" : "Lowest rated"}
          {item.dateYmd ? ` · ${formatWallDate(item.dateYmd, "medium")}` : ""}
        </p>
      </div>
      <span className="font-display text-base font-semibold tabular-nums text-ink">
        {item.score.toFixed(1)}
      </span>
    </Link>
  );
}

export function DateStatistics({
  stats,
  moneyHidden = false,
}: {
  stats: Stats;
  moneyHidden?: boolean;
}) {
  const avg =
    stats.averageCoupleScore != null
      ? {
          value: stats.averageCoupleScore.toFixed(1),
          hint: `across ${stats.scoredDateCount} rated ${
            stats.scoredDateCount === 1 ? "date" : "dates"
          }`,
        }
      : { value: "—", hint: "no revealed reviews yet" };

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-medium text-ink">By the numbers</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat icon="calendarCheck" value={stats.completedDates} label="dates completed" hint={`of ${stats.totalDates} total`} />
        <Stat icon="mapPin" value={stats.placesVisited} label="places visited" />
        <Stat icon="compass" value={stats.citiesVisited} label="cities visited" />
        <Stat icon="star" value={avg.value} label="average couple score" hint={avg.hint} />
        <Stat
          icon="sparkles"
          value={stats.favoriteCategory ? stats.favoriteCategory.label : "—"}
          label="favourite category"
          hint={
            stats.favoriteCategory
              ? `${stats.favoriteCategory.count} ${
                  stats.favoriteCategory.count === 1 ? "date" : "dates"
                }`
              : "needs a completed date"
          }
        />
        <Stat
          icon="wallet"
          value={
            moneyHidden
              ? "Hidden"
              : stats.totalSpendCents != null
                ? formatMoney(stats.totalSpendCents, stats.currency)
                : "Not tracked"
          }
          label="total recorded spend"
          hint={moneyHidden ? "you hid money figures" : undefined}
        />
      </div>

      {stats.highestRatedDate ? (
        <div className="space-y-2">
          <RatedRow tone="high" item={stats.highestRatedDate} />
          {stats.lowestRatedDate ? (
            <RatedRow tone="low" item={stats.lowestRatedDate} />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
