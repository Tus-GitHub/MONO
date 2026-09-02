import { RevisitTag } from "@/components/dates/cards/_bits";
import { PhotoGallery } from "@/components/dates/photo-gallery";
import { FavoriteHeart } from "@/components/memories/favorite-heart";
import { DateOrdinal, MilestoneBadge } from "@/components/memories/milestone-badge";
import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";
import { Photo } from "@/components/ui/photo";
import { scoreLabel } from "@/lib/review/scale";
import { formatWallDate } from "@/lib/utils/format";
import type { MemoryDetail } from "@/server/services/memory-service";

export function MemoryDetailView({ detail }: { detail: MemoryDetail }) {
  return (
    <article className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-line">
        {detail.hero ? (
          <Photo
            thumbUrl={detail.hero.thumbUrl}
            displayUrl={detail.hero.displayUrl}
            blurDataUrl={detail.hero.blurDataUrl}
            alt=""
            priority
            aspect="3 / 2"
            sizes="(min-width: 768px) 44rem, 100vw"
          />
        ) : (
          <div className="grid aspect-[3/2] w-full place-items-center bg-linear-to-br from-accent-tint via-surface to-primary-tint">
            <Icon name="images" size={40} className="text-accent/60" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/25 to-transparent p-5 pt-20">
          <DateOrdinal ordinal={detail.ordinal ?? 0} className="text-white/70" />
          <h1 className="mt-1 font-display text-2xl font-medium text-white drop-shadow-sm">
            {detail.title}
          </h1>
          <p className="text-sm text-white/85">
            {[
              detail.dateYmd ? formatWallDate(detail.dateYmd, "long") : null,
              detail.placeLabel,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-ink/40 backdrop-blur-sm">
          <FavoriteHeart kind="memory" id={detail.memoryId} isFavorite={detail.isFavorite} size={18} />
        </div>
      </div>

      {/* Milestones + favourite spot */}
      {detail.milestones.length > 0 || detail.placeIsFavorite ? (
        <div className="flex flex-wrap gap-2">
          {detail.milestones.map((milestone) => (
            <MilestoneBadge key={milestone.kind} milestone={milestone} />
          ))}
          {detail.placeIsFavorite ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-tint px-2.5 py-1 text-2xs font-medium text-primary">
              <Icon name="heart" size={12} />
              One of your favourite places
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Story */}
      {detail.story ? (
        <p className="whitespace-pre-line font-display text-lg leading-relaxed text-ink">
          {detail.story}
        </p>
      ) : null}

      {/* How it landed */}
      {detail.reviewRevealed && detail.coupleScore != null ? (
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-2xs font-medium uppercase tracking-wide text-muted">
                How it landed
              </p>
              <p className="font-display text-3xl font-semibold text-ink">
                {detail.coupleScore.toFixed(1)}
                <span className="text-lg font-medium text-muted">/10</span>
              </p>
              <p className="text-sm text-muted">{scoreLabel(detail.coupleScore)}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <RevisitTag revisit={detail.revisit} />
              {detail.revisitCompatLabel ? (
                <span className="text-2xs text-faint">{detail.revisitCompatLabel}</span>
              ) : null}
            </div>
          </div>
          {detail.topCategories.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
              {detail.topCategories.map((category) => (
                <li
                  key={category.label}
                  className="inline-flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 text-xs text-muted"
                >
                  {category.label}
                  <span className="font-semibold tabular-nums text-ink">
                    {category.score.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* One-liners */}
      {detail.planLine || detail.spendLine ? (
        <div className="space-y-2 rounded-xl border border-line bg-surface p-4 text-sm">
          {detail.planLine ? (
            <p className="flex items-start gap-2 text-muted">
              <Icon name="calendarCheck" size="sm" className="mt-0.5 shrink-0 text-faint" />
              {detail.planLine}
            </p>
          ) : null}
          {detail.spendLine ? (
            <p className="flex items-start gap-2 text-muted">
              <Icon name="wallet" size="sm" className="mt-0.5 shrink-0 text-faint" />
              {detail.spendLine}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Gallery */}
      {detail.dateId && detail.photos.length > 0 ? (
        <PhotoGallery dateId={detail.dateId} photos={detail.photos} canManage={false} />
      ) : null}

      {/* Footer actions */}
      {detail.dateId ? (
        <div className="flex flex-wrap gap-2 border-t border-line pt-5">
          <LinkButton href={`/dates/${detail.dateId}`}>Open the full date</LinkButton>
          <LinkButton href={`/dates/${detail.dateId}/memory`} variant="secondary">
            Edit the story
          </LinkButton>
        </div>
      ) : null}
    </article>
  );
}
