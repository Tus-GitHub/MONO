import Link from "next/link";

import { DateStatusBadge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Photo } from "@/components/ui/photo";
import { formatWallDate, formatWallTime } from "@/lib/utils/format";
import type { CalendarDate } from "@/server/services/calendar-service";

export function DayDetailPanel({ day, dates }: { day: string; dates: CalendarDate[] }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-medium text-ink">{formatWallDate(day)}</h2>

      {dates.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface/60 px-4 py-6 text-center text-sm text-muted">
          Nothing on this day.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {dates.map((date) => (
            <li key={date.id}>
              <Link
                href={`/dates/${date.id}`}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-ink/3"
              >
                {date.cover ? (
                  <Photo
                    thumbUrl={date.cover.thumbUrl}
                    displayUrl={date.cover.thumbUrl}
                    blurDataUrl={date.cover.blurDataUrl}
                    alt=""
                    aspect="1 / 1"
                    sizes="48px"
                    className="size-12 shrink-0 rounded-lg"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{date.title}</p>
                  <p className="truncate text-xs text-muted">
                    {date.startTime ? `${formatWallTime(date.startTime)} · ` : ""}
                    {date.placeName ?? "No place yet"}
                  </p>
                </div>
                <DateStatusBadge status={date.status} size="sm" />
                <Icon name="chevronRight" size="sm" className="text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
