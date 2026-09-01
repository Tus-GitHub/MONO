import Link from "next/link";
import { DateStatus } from "@prisma/client";

import { Icon } from "@/components/ui/icon";
import type { CalendarDate } from "@/server/services/calendar-service";
import { cn } from "@/lib/utils/cn";

const DOT: Record<DateStatus, string> = {
  DRAFT: "bg-faint",
  PLANNED: "bg-primary",
  TODAY: "bg-accent",
  IN_PROGRESS: "bg-accent",
  COMPLETED: "bg-success",
  CANCELLED: "bg-error/60",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function MonthCalendar({
  month,
  selectedDay,
  dates,
}: {
  month: string;
  selectedDay: string;
  dates: Record<string, CalendarDate[]>;
}) {
  const [year, m] = month.split("-").map(Number);
  const today = new Date().toISOString().slice(0, 10);
  // Monday-first offset for the 1st of the month.
  const firstDow = (new Date(Date.UTC(year, m - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const label = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, m - 1, 1)));

  const cells: (string | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
    ),
  ];

  return (
    <div className="rounded-2xl border border-line bg-surface p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <Link
          href={`/dates?month=${shiftMonth(month, -1)}`}
          aria-label="Previous month"
          className="tap grid place-items-center rounded-lg text-muted hover:bg-ink/6 hover:text-ink"
        >
          <Icon name="chevronLeft" size="sm" />
        </Link>
        <span className="font-display text-base font-medium text-ink">{label}</span>
        <Link
          href={`/dates?month=${shiftMonth(month, 1)}`}
          aria-label="Next month"
          className="tap grid place-items-center rounded-lg text-muted hover:bg-ink/6 hover:text-ink"
        >
          <Icon name="chevronRight" size="sm" />
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-2xs font-medium text-faint">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((ymd, index) => {
          if (!ymd) return <span key={`e${index}`} />;
          const dayDates = dates[ymd] ?? [];
          const isSelected = ymd === selectedDay;
          const isToday = ymd === today;
          return (
            <Link
              key={ymd}
              href={`/dates?month=${month}&day=${ymd}`}
              aria-current={isSelected ? "date" : undefined}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-1 rounded-lg text-sm transition-colors",
                isSelected
                  ? "bg-primary font-semibold text-primary-fg"
                  : "text-ink hover:bg-primary-tint/50",
                isToday && !isSelected && "font-semibold text-primary",
              )}
            >
              {Number(ymd.slice(8, 10))}
              <span className="flex h-1.5 gap-0.5">
                {dayDates.slice(0, 3).map((date) => (
                  <span
                    key={date.id}
                    className={cn(
                      "size-1.5 rounded-full",
                      isSelected ? "bg-primary-fg/80" : DOT[date.status],
                    )}
                  />
                ))}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
