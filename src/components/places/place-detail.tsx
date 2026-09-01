import Link from "next/link";
import { RevisitChoice } from "@prisma/client";

import { CoupleScore, PublicRating } from "@/components/explore/rating-badges";
import { SelectPlaceButton } from "@/components/explore/select-place-button";
import { Card, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { SubmitButton } from "@/components/ui/submit-button";
import { PLACE_CATEGORY_LABEL } from "@/lib/date/place-category";
import { formatDate } from "@/lib/utils/format";
import { mapsLink, priceLevelLabel } from "@/lib/utils/geo";
import { startPlanAction } from "@/server/actions/plan";
import type { PlaceDetailView } from "@/server/services/place-service";

const REVISIT_LABEL: Record<RevisitChoice, string> = {
  YES: "You'd go back",
  MAYBE: "Maybe again",
  NO: "Been there, done that",
};

export function PlaceDetail({ place, forDate }: { place: PlaceDetailView; forDate?: string }) {
  const location = [place.address, place.city].filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-line">
        {place.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={place.imageUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center bg-linear-to-br from-primary-tint via-surface to-accent-tint">
            <Icon name="mapPin" size={44} className="text-primary/60" />
          </div>
        )}
      </div>

      {place.gallery.length > 0 ? (
        <div className="scroll-x no-scrollbar -mx-4 flex gap-2 px-4 sm:mx-0 sm:px-0">
          {place.gallery.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt=""
              className="h-24 w-32 shrink-0 rounded-lg object-cover"
            />
          ))}
        </div>
      ) : null}

      <div>
        <h1 className="font-display text-2xl font-medium text-ink">{place.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {PLACE_CATEGORY_LABEL[place.category]}
          {location ? ` · ${location}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <PublicRating rating={place.externalRating} count={place.externalRatingCount} />
          {place.priceLevel != null ? (
            <span className="text-xs font-medium text-faint">{priceLevelLabel(place.priceLevel)}</span>
          ) : null}
          {place.isFavorite ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              <Icon name="heart" size={12} style={{ fill: "currentColor" }} />
              Favourite
            </span>
          ) : null}
        </div>
      </div>

      {place.description ? (
        <p className="text-sm leading-relaxed text-muted">{place.description}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <a
          href={mapsLink(place)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong"
        >
          <span className="grid size-9 place-items-center rounded-lg bg-primary-tint text-primary">
            <Icon name="mapPin" size="sm" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink">Open in Maps</span>
            <span className="block truncate text-xs text-muted">
              {place.latitude != null && place.longitude != null
                ? `${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}`
                : location || place.name}
            </span>
          </span>
        </a>
        {place.openingText ? (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4">
            <span className="grid size-9 place-items-center rounded-lg bg-primary-tint text-primary">
              <Icon name="clock" size="sm" />
            </span>
            <span className="min-w-0 text-xs text-muted">{place.openingText}</span>
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader icon={<Icon name="heart" size="sm" />} title="Your history here" />
        {place.history.visitCount === 0 ? (
          <p className="text-sm text-muted">You haven&apos;t been here yet.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink">
                {place.history.visitCount === 1
                  ? "You've been here once."
                  : `You've been here ${place.history.visitCount} times.`}
              </span>
              <CoupleScore score10={place.history.coupleScore10} />
              {place.history.lastRevisit ? (
                <span className="rounded-md bg-line/60 px-1.5 py-0.5 text-2xs font-medium text-muted">
                  {REVISIT_LABEL[place.history.lastRevisit]}
                </span>
              ) : null}
            </div>
            {place.history.lastRevisitReason ? (
              <p className="text-sm text-muted">“{place.history.lastRevisitReason}”</p>
            ) : null}
            <ul className="divide-y divide-line border-t border-line">
              {place.history.dates.map((date) => (
                <li key={date.id}>
                  <Link
                    href={`/dates/${date.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:text-primary"
                  >
                    <span className="min-w-0 truncate text-ink">{date.title}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {date.score10 != null ? `${date.score10.toFixed(1)}/10 · ` : ""}
                      {formatDate(date.completedAt, "medium")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {place.intelligence.relevance || place.intelligence.similarLiked.length > 0 ? (
        <Card>
          <CardHeader icon={<Icon name="sparkles" size="sm" />} title="For the two of you" />
          {place.intelligence.relevance ? (
            <p className="text-sm text-ink">{place.intelligence.relevance}</p>
          ) : null}
          {place.intelligence.isFavoriteCategory ? (
            <p className="mt-1 text-sm text-muted">
              {PLACE_CATEGORY_LABEL[place.category]} dates are your most-visited kind.
            </p>
          ) : null}
          {place.intelligence.similarLiked.length > 0 ? (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium text-muted">Similar places you liked</p>
              <div className="flex flex-wrap gap-1.5">
                {place.intelligence.similarLiked.map((similar) => (
                  <Link
                    key={similar.id}
                    href={`/places/${similar.id}`}
                    className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink transition-colors hover:border-primary"
                  >
                    {similar.name}
                    {similar.score10 != null ? (
                      <span className="text-muted"> · {similar.score10.toFixed(1)}</span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="sticky bottom-0 -mx-4 border-t border-line bg-elevated/85 px-4 py-3 pb-safe backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        {forDate ? (
          <SelectPlaceButton
            dateId={forDate}
            place={{
              savedPlaceId: place.id,
              external: null,
              name: place.name,
              category: place.category,
              address: place.address,
              city: place.city,
            }}
            size="lg"
            label="Select for this date"
            redirectTo={`/plan/${forDate}?step=basics`}
          />
        ) : (
          <form action={startPlanAction}>
            <input type="hidden" name="place" value={place.id} />
            <SubmitButton size="lg" fullWidth pendingText="Starting…">
              Plan a date here
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
