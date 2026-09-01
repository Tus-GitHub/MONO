import Link from "next/link";

import { ScorePill } from "@/components/dates/cards/_bits";
import { Icon } from "@/components/ui/icon";
import { Photo } from "@/components/ui/photo";
import type { DateHistoryItem } from "@/lib/date/history-item";
import { formatWallDate } from "@/lib/utils/format";

/** Square tile for the grid view — photo first, minimal chrome. */
export function GridDateCard({ item }: { item: DateHistoryItem }) {
  return (
    <Link
      href={`/dates/${item.id}`}
      className="group relative block aspect-square overflow-hidden rounded-xl border border-line bg-line"
    >
      {item.cover ? (
        <Photo
          thumbUrl={item.cover.thumbUrl}
          displayUrl={item.cover.displayUrl}
          blurDataUrl={item.cover.blurDataUrl}
          alt=""
          aspect="1 / 1"
          sizes="(min-width: 1024px) 20rem, (min-width: 640px) 33vw, 50vw"
          className="absolute inset-0 transition-transform duration-slow ease-out group-hover:scale-105"
        />
      ) : (
        <div className="grid size-full place-items-center bg-linear-to-br from-primary-tint via-surface to-accent-tint">
          <Icon name="camera" size={26} className="text-primary/60" />
        </div>
      )}

      {item.coupleScore != null ? (
        <ScorePill score={item.coupleScore} className="absolute right-2 top-2 shadow-sm" />
      ) : null}

      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/75 via-black/15 to-transparent p-2.5 pt-8">
        <p className="line-clamp-1 text-sm font-medium text-white drop-shadow-sm">{item.title}</p>
        <p className="line-clamp-1 text-2xs text-white/80">
          {[item.placeName, item.dateYmd ? formatWallDate(item.dateYmd, "medium") : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </Link>
  );
}
