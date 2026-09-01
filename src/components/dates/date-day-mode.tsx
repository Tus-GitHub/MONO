"use client";

import { useEffect, useState } from "react";
import { DateStatus } from "@prisma/client";

import { CompleteDateButton, StartDateButton } from "@/components/dates/lifecycle-buttons";
import { QuickExpenseButton } from "@/components/dates/quick-expense-button";
import { QuickPhotoButton } from "@/components/dates/quick-photo-button";
import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";
import { buildDayView, untilLabel } from "@/lib/date/day-mode";
import type { TimelineInput } from "@/lib/date/timeline";
import { formatWallTime, relativeTime, wallTimeFromIso } from "@/lib/utils/format";
import { mapsLink } from "@/lib/utils/geo";
import { cn } from "@/lib/utils/cn";

interface DayPlace {
  name: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  mapUrl: string | null;
}

function nowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function directionsUrl(place: DayPlace): string | null {
  if (place.mapUrl) return place.mapUrl;
  if (!place.name) return null;
  return mapsLink({
    name: place.name,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
  });
}

export function DateDayMode({
  dateId,
  status,
  startedByLabel,
  startedAtIso,
  plannedStartIso,
  activities,
  place,
  currency,
  partnerName = "Partner",
}: {
  dateId: string;
  status: DateStatus;
  startedByLabel: string | null;
  startedAtIso: string | null;
  plannedStartIso: string | null;
  activities: TimelineInput[];
  place: DayPlace | null;
  currency: string;
  partnerName?: string;
}) {
  const [minutes, setMinutes] = useState<number>(() => nowMinutes());

  useEffect(() => {
    const id = setInterval(() => setMinutes(nowMinutes()), 30_000);
    return () => clearInterval(id);
  }, []);

  const view = buildDayView(plannedStartIso, activities, minutes);
  const started = status === DateStatus.IN_PROGRESS;
  const directions = place ? directionsUrl(place) : null;

  const current = view.currentIndex != null ? view.slots[view.currentIndex] : null;
  const next = view.nextIndex != null ? view.slots[view.nextIndex] : null;

  const slotProgress =
    current && current.startMinutes != null && current.minutes > 0
      ? Math.min(1, Math.max(0, (minutes - current.startMinutes) / current.minutes))
      : 0;

  const headline = !started
    ? "It's today."
    : view.phase === "before"
      ? "Getting started"
      : view.phase === "after"
        ? "You've done everything you planned"
        : view.phase === "untimed"
          ? "On the date"
          : "Happening now";

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      <div className="border-b border-line bg-primary-tint/50 px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-base font-medium text-ink">{headline}</p>
          {started ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-tint px-2.5 py-1 text-2xs font-medium text-warning">
              <span className="size-1.5 rounded-full bg-current" />
              In progress
            </span>
          ) : null}
        </div>
        {started && startedByLabel ? (
          <p className="mt-0.5 text-xs text-muted">
            Started by {startedByLabel}
            {startedAtIso ? ` · ${relativeTime(startedAtIso)}` : ""}
          </p>
        ) : null}
      </div>

      <div className="space-y-5 p-5">
        {!started ? (
          <>
            {place?.name ? (
              <p className="flex items-center gap-2 text-sm text-ink">
                <Icon name="mapPin" size="sm" className="text-muted" />
                {place.name}
                {place.city ? <span className="text-muted">· {place.city}</span> : null}
              </p>
            ) : null}
            {view.minutesToStart != null ? (
              <p className="text-sm text-muted">
                {view.slots[0]?.startAt
                  ? `Starts around ${formatWallTime(wallTimeFromIso(view.slots[0].startAt))} — ${untilLabel(view.minutesToStart)}`
                  : "Ready when you are."}
              </p>
            ) : null}
            <StartDateButton dateId={dateId} />
            <p className="text-xs text-faint">
              Once you start, MONO follows the plan through the evening — you don&apos;t have to
              check anything off.
            </p>
          </>
        ) : (
          <>
            <div className="rounded-lg border border-line bg-paper/60 p-4">
              {current ? (
                <>
                  <p className="text-2xs font-medium uppercase tracking-wide text-primary">Now</p>
                  <p className="mt-1 font-display text-xl font-medium text-ink">{current.title}</p>
                  {current.startAt ? (
                    <p className="mt-0.5 text-xs text-muted">
                      {formatWallTime(wallTimeFromIso(current.startAt))}
                      {current.endAt ? ` – ${formatWallTime(wallTimeFromIso(current.endAt))}` : ""}
                    </p>
                  ) : null}
                  {current.startMinutes != null ? (
                    <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-slow"
                        style={{ width: `${Math.round(slotProgress * 100)}%` }}
                      />
                    </div>
                  ) : null}
                </>
              ) : view.phase === "before" && next ? (
                <>
                  <p className="text-2xs font-medium uppercase tracking-wide text-primary">
                    Up first
                  </p>
                  <p className="mt-1 font-display text-xl font-medium text-ink">{next.title}</p>
                  {next.startAt ? (
                    <p className="mt-0.5 text-xs text-muted">
                      at {formatWallTime(wallTimeFromIso(next.startAt))} ·{" "}
                      {untilLabel(view.minutesToStart)}
                    </p>
                  ) : null}
                </>
              ) : view.phase === "untimed" && next ? (
                <>
                  <p className="text-2xs font-medium uppercase tracking-wide text-primary">Next</p>
                  <p className="mt-1 font-display text-xl font-medium text-ink">{next.title}</p>
                  <p className="mt-0.5 text-xs text-muted">No set time — go with the flow.</p>
                </>
              ) : (
                <>
                  <p className="text-2xs font-medium uppercase tracking-wide text-primary">
                    Nothing scheduled
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {activities.length === 0
                      ? "There was no activity list — just enjoy it."
                      : "You've reached the end of the plan. Stay as long as you like."}
                  </p>
                </>
              )}
            </div>

            {current && next ? (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Icon name="arrowRight" size="sm" className="text-faint" />
                Next: <span className="text-ink">{next.title}</span>
                {next.startAt ? ` at ${formatWallTime(wallTimeFromIso(next.startAt))}` : ""}
              </p>
            ) : null}

            {place?.name ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-3.5 py-2.5">
                <p className="flex items-center gap-2 text-sm text-ink">
                  <Icon name="mapPin" size="sm" className="text-muted" />
                  {place.name}
                  {place.city ? <span className="text-muted">· {place.city}</span> : null}
                </p>
                {directions ? (
                  <a
                    href={directions}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover"
                  >
                    <Icon name="compass" size="sm" />
                    Directions
                  </a>
                ) : null}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <QuickPhotoButton dateId={dateId} size="sm" fullWidth />
              <QuickExpenseButton
                dateId={dateId}
                currency={currency}
                partnerName={partnerName}
                size="sm"
                fullWidth
              />
              <LinkButton
                href={`/dates/${dateId}/recap`}
                variant="secondary"
                size="sm"
                fullWidth
                leadingIcon={<Icon name="pencil" size="sm" />}
              >
                Record it
              </LinkButton>
            </div>

            <CompleteDateButton dateId={dateId} />
          </>
        )}
      </div>

      {!started && activities.length > 0 ? (
        <ol className="space-y-2 border-t border-line px-5 py-4">
          {view.slots.map((slot) => (
            <li key={slot.id} className="flex items-baseline gap-3 text-sm">
              <span className={cn("w-16 shrink-0 tabular-nums text-muted")}>
                {slot.startAt ? formatWallTime(wallTimeFromIso(slot.startAt)) : "—"}
              </span>
              <span className="text-ink">{slot.title}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
