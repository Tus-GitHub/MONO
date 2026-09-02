import Link from "next/link";

import { RevisitTag, ScorePill } from "@/components/dates/cards/_bits";
import { DateOrdinal, MilestoneBadge } from "@/components/memories/milestone-badge";
import { Icon } from "@/components/ui/icon";
import { Photo } from "@/components/ui/photo";
import type { Milestone } from "@/lib/date/milestones";
import type { DateHistoryItem } from "@/lib/date/history-item";
import { formatWallDate } from "@/lib/utils/format";

/** A chronological memory — photo-dominant, with its true date number and any real milestone. */
export function MemoryTimelineItem({
  item,
  ordinal,
  milestones,
}: {
  item: DateHistoryItem;
  ordinal: number;
  milestones: Milestone[];
}) {
  const href = item.memoryId ? `/memories/${item.memoryId}` : `/dates/${item.id}`;

  return (
    <li className="relative pl-7">
      <span className="absolute left-0 top-7 -ml-[5px] size-2.5 rounded-full border-2 border-paper bg-primary" />

      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <DateOrdinal ordinal={ordinal} />
        {milestones.map((milestone) => (
          <MilestoneBadge key={milestone.kind} milestone={milestone} />
        ))}
        {item.placeIsFavorite ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2 py-0.5 text-2xs font-medium text-primary">
            <Icon name="heart" size={11} />
            Favourite spot
          </span>
        ) : null}
      </div>

      <Link
        href={href}
        className="group block overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition-colors hover:border-line-strong"
      >
        <div className="relative aspect-[16/9] w-full bg-line sm:aspect-[2/1]">
          {item.cover ? (
            <Photo
              thumbUrl={item.cover.thumbUrl}
              displayUrl={item.cover.displayUrl}
              blurDataUrl={item.cover.blurDataUrl}
              alt=""
              aspect="2 / 1"
              sizes="(min-width: 768px) 42rem, 100vw"
              className="absolute inset-0 transition-transform duration-slow ease-out group-hover:scale-[1.02]"
            />
          ) : (
            <div className="grid size-full place-items-center bg-linear-to-br from-accent-tint via-surface to-primary-tint">
              <Icon name="camera" size={32} className="text-accent/60" />
            </div>
          )}
          {item.coupleScore != null ? (
            <ScorePill score={item.coupleScore} className="absolute right-3 top-3 shadow-sm" />
          ) : null}
        </div>

        <div className="space-y-2 p-4">
          <p className="text-xs text-muted">
            {[
              item.dateYmd ? formatWallDate(item.dateYmd, "long") : null,
              item.placeName,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <h3 className="font-display text-lg font-medium text-ink">
            {item.memoryTitle || item.title}
          </h3>
          {item.memorySnippet ? (
            <p className="line-clamp-3 text-sm leading-relaxed text-muted">
              “{item.memorySnippet}”
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <RevisitTag revisit={item.revisit} />
            {item.photoCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-2xs text-faint">
                <Icon name="images" size={11} />
                {item.photoCount}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  );
}
