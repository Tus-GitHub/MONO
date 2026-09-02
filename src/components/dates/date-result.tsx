import Link from "next/link";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";
import { Photo } from "@/components/ui/photo";
import { PLACE_CATEGORY_LABEL } from "@/lib/date/place-category";
import type { RevisitCompatibility } from "@/lib/review/comparison";
import { scoreLabel, scoreTone } from "@/lib/review/scale";
import { formatWallDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { DateExperience } from "@/server/services/date-service";

const CHIP_TONE = {
  high: "bg-success-tint text-success",
  mid: "bg-rating/15 text-rating",
  low: "bg-warning-tint text-warning",
} as const;

const REVISIT_TONE: Record<RevisitCompatibility["tone"], BadgeTone> = {
  high: "success",
  mid: "warning",
  low: "neutral",
};

function snippet(text: string, max = 190): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ")).trimEnd()}…`;
}

/**
 * The permanent summary of a finished, fully-reviewed date — the thing you come back to.
 * Rendered only when the date is COMPLETED and both reviews have revealed.
 */
export function DateResult({ data }: { data: DateExperience }) {
  const { date, plan, actual, photos, review, memory } = data;
  const comparison = review.comparison;

  const best = photos.find((photo) => photo.isBest) ?? photos[0] ?? null;
  const place = actual.place ?? plan.place;
  const placeLine = place
    ? `${place.name}${place.city ? `, ${place.city}` : ""} · ${PLACE_CATEGORY_LABEL[place.category]}`
    : (actual.label ?? plan.placeName);
  const dateLine = actual.dateYmd ?? date.scheduledForYmd;
  const score = comparison?.coupleScore ?? null;

  return (
    <section className="anim-rise overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="relative">
        {best ? (
          <Photo
            thumbUrl={best.thumbUrl}
            displayUrl={best.displayUrl}
            blurDataUrl={best.blurDataUrl}
            alt=""
            priority
            aspect="2 / 1"
            sizes="(min-width: 640px) 40rem, 100vw"
          />
        ) : (
          <div className="grid aspect-[2/1] w-full place-items-center bg-linear-to-br from-primary-tint via-surface to-accent-tint">
            <Icon name="camera" size={36} className="text-primary/60" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 via-black/25 to-transparent p-4 pt-14">
          <p className="text-2xs font-medium uppercase tracking-wide text-white/70">The result</p>
          <p className="font-display text-xl font-medium text-white drop-shadow-sm">{date.title}</p>
          <p className="text-sm text-white/85">
            {[placeLine, dateLine ? formatWallDate(dateLine, "long") : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-2xs font-medium uppercase tracking-wide text-muted">
              Combined couple score
            </p>
            <p className="font-display text-4xl font-semibold text-ink">
              {score != null ? score.toFixed(1) : "—"}
              <span className="text-xl font-medium text-muted">/10</span>
            </p>
            {score != null ? (
              <p className="text-sm text-muted">{scoreLabel(score)}</p>
            ) : null}
          </div>
          {review.revisitCompat ? (
            <Badge tone={REVISIT_TONE[review.revisitCompat.tone]} size="md">
              <Icon name="refresh" size={12} />
              {review.revisitCompat.label}
            </Badge>
          ) : null}
        </div>

        {comparison && comparison.categories.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {comparison.categories.map((category) => (
              <li
                key={category.id}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                  category.combined != null
                    ? CHIP_TONE[scoreTone(category.combined)]
                    : "bg-line/60 text-muted",
                )}
              >
                {category.label}
                <span className="tabular-nums">
                  {category.combined != null ? category.combined.toFixed(1) : "–"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {memory ? (
          <div className="rounded-xl border border-line bg-paper/60 p-4">
            <p className="text-sm font-medium text-ink">{memory.title || "Your memory"}</p>
            {memory.body ? (
              <p className="mt-1 text-sm leading-relaxed text-muted">{snippet(memory.body)}</p>
            ) : null}
            <Link
              href="#memory"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover"
            >
              View full memory
              <Icon name="arrowRight" size={13} />
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-line bg-surface/60 p-4">
            <p className="text-sm text-muted">No memory kept from this one yet.</p>
            <LinkButton href={`/dates/${date.id}/memory`} variant="secondary" size="sm">
              Keep the memory
            </LinkButton>
          </div>
        )}

        {photos.length > 0 ? (
          <Link href="#photos" className="flex items-center gap-2">
            {photos.slice(0, 5).map((photo) => (
              <span
                key={photo.id}
                className="size-12 shrink-0 overflow-hidden rounded-lg border border-line"
              >
                <Photo
                  thumbUrl={photo.thumbUrl}
                  displayUrl={photo.thumbUrl}
                  blurDataUrl={photo.blurDataUrl}
                  alt=""
                  aspect="1 / 1"
                  sizes="48px"
                />
              </span>
            ))}
            {photos.length > 5 ? (
              <span className="text-xs font-medium text-muted">+{photos.length - 5} more</span>
            ) : (
              <span className="text-xs text-muted">All photos</span>
            )}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
