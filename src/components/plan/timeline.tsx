import { Icon } from "@/components/ui/icon";
import { buildTimeline, type TimelineInput } from "@/lib/date/timeline";
import {
  formatDurationMinutes,
  formatMoney,
  formatWallTime,
  wallTimeFromIso,
} from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/** The visual date timeline: "6:00 PM → Coffee". Pure — safe on server or client. */
export function Timeline({
  activities,
  startIso,
  currency = "USD",
  className,
}: {
  activities: TimelineInput[];
  startIso: string | null;
  currency?: string;
  className?: string;
}) {
  if (activities.length === 0) {
    return (
      <p className={cn("text-sm text-muted", className)}>
        No activities yet — the timeline fills in as you add them.
      </p>
    );
  }

  const slots = buildTimeline(startIso, activities);

  return (
    <ol className={cn("relative space-y-3 border-l border-line pl-5", className)}>
      {slots.map((slot) => (
        <li key={slot.id} className="relative">
          <span className="absolute -left-[1.42rem] top-1.5 size-2 rounded-full bg-primary ring-4 ring-surface" />
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">
                {slot.startAt ? (
                  <span className="text-muted">{formatWallTime(wallTimeFromIso(slot.startAt))} → </span>
                ) : null}
                {slot.title}
              </p>
              <p className="text-xs text-muted">
                {formatDurationMinutes(slot.minutes)}
                {slot.costCents ? ` · ${formatMoney(slot.costCents, currency)}` : ""}
              </p>
            </div>
          </div>
        </li>
      ))}
      {!startIso ? (
        <li className="flex items-center gap-1.5 pt-1 text-xs text-faint">
          <Icon name="clock" size={12} />
          Set a start time on step 1 to see the clock.
        </li>
      ) : null}
    </ol>
  );
}
