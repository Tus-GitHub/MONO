import Link from "@/components/ui/app-link";
import { PhotoCredit } from "@/components/places/photo-credit";
import { PlaceImage } from "@/components/places/place-image";
import { PlaceAttribution } from "@/components/places/place-attribution";
import { Button } from "@/components/ui/button";
import { PlaceCategory, type RecommendationSignal } from "@prisma/client";

import { FavoriteButton } from "@/components/explore/favorite-button";
import { CoupleScore, PublicRating } from "@/components/explore/rating-badges";
import { RecFeedback } from "@/components/explore/rec-feedback";
import { SelectPlaceButton } from "@/components/explore/select-place-button";
import { VisitedBadge } from "@/components/explore/visited-badge";
import { Icon } from "@/components/ui/icon";
import { PLACE_CATEGORY_ICON, PLACE_CATEGORY_LABEL } from "@/lib/date/place-category";
import { classifyVisited } from "@/lib/explore/visited";
import { formatDistanceKm, priceLevelLabel } from "@/lib/utils/geo";
import type { PlaceSearchResult } from "@/server/services/place-search-service";

export function PlaceCard({
  place,
  forDate,
  feedbackSignal = null,
  onChoose,
  disabled = false,
}: {
  place: PlaceSearchResult;
  forDate?: string;
  feedbackSignal?: RecommendationSignal | null;
  onChoose?: () => void;
  disabled?: boolean;
}) {
  const category = place.category ?? PlaceCategory.OTHER;
  const visitedStatus = classifyVisited({
    visitCount: place.visitCount,
    coupleScore10: place.coupleScore10,
    lastRevisit: place.lastRevisit,
    notForUs: feedbackSignal === "NOT_FOR_US",
  });
  const location = [place.city, place.address].filter(Boolean).join(" · ");
  const ref = {
    savedPlaceId: place.savedPlaceId,
    external: place.external,
    name: place.name,
    category,
    address: place.address,
    city: place.city,
  };

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <div className="relative aspect-[4/3] bg-line">
        {place.imageUrl ? (
          <PlaceImage src={place.imageUrl} name={place.name} />
        ) : (
          <div className="grid size-full place-items-center bg-linear-to-br from-primary-tint via-surface to-accent-tint">
            <Icon name={PLACE_CATEGORY_ICON[category]} size={32} className="text-primary/60" />
          </div>
        )}
        {!onChoose ? <FavoriteButton
          place={ref}
          initialFavorite={place.isFavorite}
          className="absolute right-2 top-2"
        /> : null}
        {visitedStatus !== "new" ? (
          <span className="absolute left-2 top-2">
            <VisitedBadge status={visitedStatus} />
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <PhotoCredit photo={place.photo} />
        <div>
          <p className="wrap-anywhere text-sm font-medium text-ink">{place.name}</p>
          <p className="line-clamp-3 text-xs text-muted">
            {PLACE_CATEGORY_LABEL[category]}
            {location ? ` · ${location}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <PublicRating rating={place.externalRating} count={place.externalRatingCount} source={place.externalRatingSource} />
          {place.priceLevel != null ? (
            <span className="text-2xs font-medium text-faint">{priceLevelLabel(place.priceLevel)}</span>
          ) : null}
          {place.distanceKm != null ? (
            <span className="text-2xs text-faint">{formatDistanceKm(place.distanceKm)}</span>
          ) : null}
        </div>

        {place.coupleScore10 != null ? <CoupleScore score10={place.coupleScore10} /> : null}

        {!onChoose && place.savedPlaceId && !forDate ? (
          <RecFeedback
            targetType="PLACE"
            targetKey={place.savedPlaceId}
            initial={feedbackSignal}
          />
        ) : null}

        {place.external?.provider === "indiarestros" ? <PlaceAttribution provider="indiarestros" url={place.externalUrl} /> : null}
        <div className="mt-auto pt-1">
          {onChoose ? <Button size="sm" variant="secondary" className="w-full" disabled={disabled} onClick={onChoose} aria-label={`Choose ${place.name}`}>Choose</Button> : forDate ? (
            <SelectPlaceButton
              dateId={forDate}
              place={ref}
              label="Choose"
              redirectTo={`/plan/${forDate}?step=basics`}
            />
          ) : place.savedPlaceId ? (
            <Link
              href={`/places/${place.savedPlaceId}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary-hover"
            >
              Details
              <Icon name="chevronRight" size={13} />
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
