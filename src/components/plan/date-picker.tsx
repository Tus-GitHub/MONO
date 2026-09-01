"use client";

import { useState } from "react";

import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}
function ymdToUtcNoon(ymd: string): Date {
  return new Date(`${ymd}T12:00:00.000Z`);
}
function addDays(ymd: string, days: number): string {
  const d = ymdToUtcNoon(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function nextSaturday(from: string): string {
  const dow = ymdToUtcNoon(from).getUTCDay(); // 0 Sun .. 6 Sat
  return addDays(from, (6 - dow + 7) % 7);
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function DatePicker({
  value,
  onChange,
  className,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string;
}) {
  const today = todayYmd();
  const anchor = value ?? today;
  const [view, setView] = useState(() => ({
    year: Number(anchor.slice(0, 4)),
    month: Number(anchor.slice(5, 7)) - 1,
  }));

  const shortcuts: { label: string; ymd: string }[] = [
    { label: "Today", ymd: today },
    { label: "Tomorrow", ymd: addDays(today, 1) },
    { label: "This weekend", ymd: nextSaturday(today) },
    { label: "Next weekend", ymd: addDays(nextSaturday(today), 7) },
  ];

  const firstDow = new Date(Date.UTC(view.year, view.month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
  const monthLabel = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(view.year, view.month, 1)));

  const cells: (string | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = String(i + 1).padStart(2, "0");
      return `${view.year}-${String(view.month + 1).padStart(2, "0")}-${day}`;
    }),
  ];

  const shiftMonth = (delta: number) =>
    setView((v) => {
      const next = new Date(Date.UTC(v.year, v.month + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });

  return (
    <div className={cn("space-y-3", className)}>
      <div className="scroll-x no-scrollbar -mx-1 flex gap-2 px-1">
        {shortcuts.map((shortcut) => (
          <Chip
            key={shortcut.label}
            selected={value === shortcut.ymd}
            onClick={() => onChange(value === shortcut.ymd ? null : shortcut.ymd)}
          >
            {shortcut.label}
          </Chip>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-surface p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
            className="tap grid place-items-center rounded-lg text-muted hover:bg-ink/[0.06] hover:text-ink"
          >
            <Icon name="chevronLeft" size="sm" />
          </button>
          <span className="text-sm font-medium text-ink">{monthLabel}</span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
            className="tap grid place-items-center rounded-lg text-muted hover:bg-ink/[0.06] hover:text-ink"
          >
            <Icon name="chevronRight" size="sm" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-2xs text-faint">
          {WEEKDAYS.map((day, i) => (
            <span key={i}>{day}</span>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((ymd, index) => {
            if (!ymd) return <span key={`e${index}`} />;
            const isPast = ymd < today;
            const isSelected = ymd === value;
            const isToday = ymd === today;
            return (
              <button
                key={ymd}
                type="button"
                disabled={isPast}
                aria-pressed={isSelected}
                onClick={() => onChange(isSelected ? null : ymd)}
                className={cn(
                  "grid h-9 place-items-center rounded-lg text-sm transition-colors",
                  isPast && "cursor-not-allowed text-faint/60",
                  !isPast && !isSelected && "text-ink hover:bg-primary-tint/60",
                  isSelected && "bg-primary font-semibold text-primary-fg",
                  isToday && !isSelected && "font-semibold text-primary",
                )}
              >
                {Number(ymd.slice(8, 10))}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
