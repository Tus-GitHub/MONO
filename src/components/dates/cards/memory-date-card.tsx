import Link from "@/components/ui/app-link";

import { ScorePill, RevisitTag } from "@/components/dates/cards/_bits";
import { Icon } from "@/components/ui/icon";
import { Photo } from "@/components/ui/photo";
import type { DateHistoryItem } from "@/lib/date/history-item";
import { formatWallDate } from "@/lib/utils/format";

/** The large, feature-sized representation — used for a spotlighted date. */
export function MemoryDateCard({ item, eyebrow, memory = false }: { item: DateHistoryItem; eyebrow?: string; memory?: boolean }) {
  return (
    <Link
      href={memory && item.memoryId ? `/memories/${item.memoryId}` : `/dates/${item.id}`}
      className="group block min-w-0 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition-colors hover:border-line-strong"
    >
      <div className="relative aspect-[3/2] w-full bg-line sm:aspect-[2/1]">
        {item.cover ? (
          <Photo
            thumbUrl={item.cover.thumbUrl}
            displayUrl={item.cover.displayUrl}
            blurDataUrl={item.cover.blurDataUrl}
            alt=""
            priority
            aspect="2 / 1"
            sizes="(min-width: 768px) 44rem, 100vw"
            fill
          />
        ) : (
          <div className="grid size-full place-items-center bg-linear-to-br from-accent-tint via-surface to-primary-tint">
            <Icon name="camera" size={40} className="text-accent/60" />
          </div>
        )}
      </div>
        <div className="space-y-1 px-4 pt-4 [overflow-wrap:anywhere]">
          {eyebrow ? (
            <p className="text-2xs font-medium uppercase tracking-wide text-primary">{eyebrow}</p>
          ) : null}
          <p className="font-display text-xl font-medium text-ink">
            {memory ? item.memoryTitle || item.title : item.title}
          </p>
          <p className="text-sm leading-relaxed text-muted">
            {[
              item.placeName,
              item.dateYmd ? formatWallDate(item.dateYmd, "long") : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

      <div className="flex flex-wrap items-center gap-2 p-4">
        <ScorePill score={item.coupleScore} size="lg" />
        <RevisitTag revisit={item.revisit} />
        {item.memorySnippet ? (
          <p className="mt-1 w-full text-sm leading-relaxed text-muted [overflow-wrap:anywhere]">“{item.memorySnippet}”</p>
        ) : null}
        <span className="ml-auto inline-flex min-h-9 shrink-0 items-center gap-1 whitespace-nowrap text-sm font-medium text-primary">
          {memory && item.memoryId ? "Open memory" : "Open date"}
          <Icon name="arrowRight" size={14} />
        </span>
      </div>
    </Link>
  );
}
