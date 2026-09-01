import { Countdown } from "@/components/home/countdown";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";
import { Photo } from "@/components/ui/photo";
import { PLACE_CATEGORY_ICON } from "@/lib/date/place-category";
import { countdownLabel, formatDate, formatMoney, formatTimeRange } from "@/lib/utils/format";
import type { UpcomingDateView } from "@/server/services/home-service";

export function UpcomingDateCard({ date }: { date: UpcomingDateView }) {
  const target = date.startAt ?? date.scheduledFor;
  const heroIcon = date.placeCategory ? PLACE_CATEGORY_ICON[date.placeCategory] : "calendar";
  const shownActivities = date.activities.slice(0, 3);
  const extraActivities = date.activityCount - shownActivities.length;

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="relative aspect-video w-full bg-line">
        {date.cover ? (
          <Photo
            thumbUrl={date.cover.thumbUrl}
            displayUrl={date.cover.displayUrl}
            blurDataUrl={date.cover.blurDataUrl}
            alt=""
            priority
            aspect="16 / 9"
            sizes="(min-width: 1024px) 640px, 100vw"
            className="absolute inset-0"
          />
        ) : (
          <div className="grid size-full place-items-center bg-linear-to-br from-primary-tint via-surface to-accent-tint">
            <Icon name={heroIcon} size={40} className="text-primary/70" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Badge tone="neutral">{date.status === "IN_PROGRESS" ? "In progress" : "Next up"}</Badge>
        </div>
        {target ? (
          <div className="absolute right-3 top-3">
            <Countdown target={target} initialLabel={countdownLabel(target)} />
          </div>
        ) : null}
      </div>

      <div className="space-y-4 p-5">
        <div>
          <h2 className="font-display text-xl font-medium text-ink">{date.title}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            {date.placeName ? (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="mapPin" size="sm" />
                {date.placeName}
                {date.placeCity ? `, ${date.placeCity}` : ""}
              </span>
            ) : null}
            {date.scheduledFor ? (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="calendar" size="sm" />
                {formatDate(date.scheduledFor, "full")}
              </span>
            ) : null}
            {formatTimeRange(date.startAt, date.endAt) ? (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="clock" size="sm" />
                {formatTimeRange(date.startAt, date.endAt)}
              </span>
            ) : null}
          </div>
        </div>

        {shownActivities.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {shownActivities.map((activity) => (
              <span
                key={activity}
                className="rounded-full border border-line bg-paper px-2.5 py-1 text-xs text-muted"
              >
                {activity}
              </span>
            ))}
            {extraActivities > 0 ? (
              <span className="rounded-full border border-line bg-paper px-2.5 py-1 text-xs text-muted">
                +{extraActivities} more
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-sm text-muted">
            Expected budget{" "}
            <span className="font-medium text-ink">
              {formatMoney(date.expectedBudgetCents, date.currency)}
            </span>
          </span>
          <div className="flex gap-2">
            <LinkButton href={`/plan/${date.id}`} variant="secondary" size="sm">
              Edit plan
            </LinkButton>
            <LinkButton href={`/dates/${date.id}`} size="sm">
              Open date
            </LinkButton>
          </div>
        </div>
      </div>
    </section>
  );
}
