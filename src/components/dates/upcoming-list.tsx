import Link from "next/link";
import { DateStatus } from "@prisma/client";

import { Countdown } from "@/components/home/countdown";
import { DateStatusBadge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";
import { countdownLabel, formatMoney, formatWallDate, formatWallTime } from "@/lib/utils/format";

export interface UpcomingItem {
  id: string;
  title: string;
  status: DateStatus;
  scheduledForIso: string | null;
  startIso: string | null;
  placeLabel: string | null;
  activities: string[];
  activityCount: number;
  expectedBudgetCents: number | null;
  currency: string;
}

function Meta({ item }: { item: UpcomingItem }) {
  const day = item.scheduledForIso
    ? formatWallDate(item.scheduledForIso.slice(0, 10), "medium")
    : "No date yet";
  const time = item.startIso ? formatWallTime(item.startIso.slice(11, 16)) : null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      <span className="inline-flex items-center gap-1">
        <Icon name="calendar" size={12} />
        {day}
        {time ? ` · ${time}` : ""}
      </span>
      {item.placeLabel ? (
        <span className="inline-flex items-center gap-1">
          <Icon name="mapPin" size={12} />
          {item.placeLabel}
        </span>
      ) : null}
      {item.activityCount > 0 ? (
        <span>
          {item.activityCount} {item.activityCount === 1 ? "activity" : "activities"}
        </span>
      ) : null}
      {item.expectedBudgetCents != null ? (
        <span>{formatMoney(item.expectedBudgetCents, item.currency)}</span>
      ) : null}
    </div>
  );
}

export function UpcomingList({ items }: { items: UpcomingItem[] }) {
  if (items.length === 0) return null;
  const [next, ...rest] = items;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-primary/20 bg-primary-tint/30 p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-2xs font-semibold uppercase tracking-wide text-primary">
            Next up
          </span>
          {next.scheduledForIso ? (
            <Countdown
              target={next.scheduledForIso}
              initialLabel={countdownLabel(next.startIso ?? next.scheduledForIso)}
            />
          ) : null}
        </div>
        <h2 className="mt-1.5 font-display text-xl font-medium text-ink">{next.title}</h2>
        <div className="mt-1.5">
          <Meta item={next} />
        </div>
        {next.activities.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {next.activities.slice(0, 4).map((activity) => (
              <span
                key={activity}
                className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-muted"
              >
                {activity}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-4 flex gap-2">
          <LinkButton href={`/plan/${next.id}`} variant="secondary" size="sm">
            Edit plan
          </LinkButton>
          <LinkButton href={`/dates/${next.id}`} size="sm">
            Open date
          </LinkButton>
        </div>
      </section>

      {rest.length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {rest.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3.5">
              <Link href={`/dates/${item.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                <Meta item={item} />
              </Link>
              <DateStatusBadge status={item.status} size="sm" />
              <LinkButton href={`/plan/${item.id}`} variant="ghost" size="sm">
                Edit
              </LinkButton>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
