import Link from "next/link";

import { MatchBadge, MatchReason } from "@/components/explore/match-badge";
import { RecFeedback } from "@/components/explore/rec-feedback";
import { VisitedBadge } from "@/components/explore/visited-badge";
import { Icon } from "@/components/ui/icon";
import { PLACE_CATEGORY_ICON } from "@/lib/date/place-category";
import type { RecommendedPlace } from "@/server/services/explore-service";

export function RecommendationCard({ place }: { place: RecommendedPlace }) {
  const location = [place.categoryLabel, place.city].filter(Boolean).join(" · ");

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <div className="relative aspect-[4/3] bg-line">
        {place.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={place.imageUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center bg-linear-to-br from-primary-tint via-surface to-accent-tint">
            <Icon name={PLACE_CATEGORY_ICON[place.category]} size={30} className="text-primary/60" />
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <MatchBadge match={place.match} />
          <VisitedBadge status={place.status} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{place.name}</p>
          <p className="truncate text-xs text-muted">{location}</p>
        </div>

        <MatchReason match={place.match} />

        <div className="mt-auto space-y-2 pt-1">
          <RecFeedback targetType="PLACE" targetKey={place.placeId} initial={place.feedback} />
          <div className="flex items-center gap-3">
            <Link
              href={`/plan?place=${place.placeId}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary-hover"
            >
              Plan this
              <Icon name="arrowRight" size={13} />
            </Link>
            <Link
              href={`/places/${place.placeId}`}
              className="text-xs font-medium text-muted transition-colors hover:text-ink"
            >
              Details
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
