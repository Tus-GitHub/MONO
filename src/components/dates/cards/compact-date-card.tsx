import Link from "next/link";

import { ScorePill, RevisitTag } from "@/components/dates/cards/_bits";
import { Icon } from "@/components/ui/icon";
import { Photo } from "@/components/ui/photo";
import type { DateHistoryItem } from "@/lib/date/history-item";
import { formatWallDate } from "@/lib/utils/format";

/** One-line representation — a dense list row. */
export function CompactDateCard({ item }: { item: DateHistoryItem }) {
  return (
    <Link
      href={`/dates/${item.id}`}
      className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-paper/70"
    >
      <span className="size-12 shrink-0 overflow-hidden rounded-lg border border-line bg-line">
        {item.cover ? (
          <Photo
            thumbUrl={item.cover.thumbUrl}
            displayUrl={item.cover.thumbUrl}
            blurDataUrl={item.cover.blurDataUrl}
            alt=""
            aspect="1 / 1"
            sizes="48px"
          />
        ) : (
          <span className="grid size-full place-items-center text-faint">
            <Icon name="camera" size={16} />
          </span>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{item.title}</p>
        <p className="truncate text-xs text-muted">
          {[
            item.dateYmd ? formatWallDate(item.dateYmd, "medium") : null,
            item.placeName,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <RevisitTag revisit={item.revisit} />
        <ScorePill score={item.coupleScore} />
        <Icon name="chevronRight" size="sm" className="text-faint" />
      </div>
    </Link>
  );
}
