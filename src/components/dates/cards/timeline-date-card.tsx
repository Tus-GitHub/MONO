import Link from "next/link";

import { ScorePill, RevisitTag } from "@/components/dates/cards/_bits";
import { Icon } from "@/components/ui/icon";
import { Photo } from "@/components/ui/photo";
import type { DateHistoryItem } from "@/lib/date/history-item";
import { formatWallDate } from "@/lib/utils/format";

/** The default history row — photo-forward, with the couple score and a line of the memory. */
export function TimelineDateCard({ item }: { item: DateHistoryItem }) {
  return (
    <li className="relative pl-7">
      <span className="absolute left-0 top-6 -ml-[5px] size-2.5 rounded-full border-2 border-paper bg-primary" />
      <Link
        href={`/dates/${item.id}`}
        className="group block overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition-colors hover:border-line-strong"
      >
        <div className="relative aspect-[16/9] w-full bg-line sm:aspect-[21/9]">
          {item.cover ? (
            <Photo
              thumbUrl={item.cover.thumbUrl}
              displayUrl={item.cover.displayUrl}
              blurDataUrl={item.cover.blurDataUrl}
              alt=""
              aspect="21 / 9"
              sizes="(min-width: 768px) 42rem, 100vw"
              className="absolute inset-0 transition-transform duration-slow ease-out group-hover:scale-[1.02]"
            />
          ) : (
            <div className="grid size-full place-items-center bg-linear-to-br from-primary-tint via-surface to-accent-tint">
              <Icon name="camera" size={32} className="text-primary/60" />
            </div>
          )}
          {item.coupleScore != null ? (
            <ScorePill score={item.coupleScore} className="absolute right-3 top-3 shadow-sm" />
          ) : null}
        </div>

        <div className="space-y-2 p-4">
          <p className="text-xs text-muted">
            {[
              item.dateYmd ? formatWallDate(item.dateYmd, "medium") : null,
              item.placeName,
              item.placeCategoryLabel,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <h3 className="font-display text-lg font-medium text-ink">{item.title}</h3>

          {item.memorySnippet ? (
            <p className="line-clamp-2 text-sm leading-relaxed text-muted">
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
            {!item.reviewRevealed ? (
              <span className="text-2xs text-faint">Review not revealed</span>
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  );
}
