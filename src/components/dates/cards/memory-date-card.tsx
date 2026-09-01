import Link from "next/link";

import { ScorePill, RevisitTag } from "@/components/dates/cards/_bits";
import { Icon } from "@/components/ui/icon";
import { Photo } from "@/components/ui/photo";
import type { DateHistoryItem } from "@/lib/date/history-item";
import { formatWallDate } from "@/lib/utils/format";

/** The large, feature-sized representation — used for a spotlighted date. */
export function MemoryDateCard({ item, eyebrow }: { item: DateHistoryItem; eyebrow?: string }) {
  return (
    <Link
      href={`/dates/${item.id}`}
      className="group block overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition-colors hover:border-line-strong"
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
            className="absolute inset-0 transition-transform duration-slow ease-out group-hover:scale-[1.02]"
          />
        ) : (
          <div className="grid size-full place-items-center bg-linear-to-br from-accent-tint via-surface to-primary-tint">
            <Icon name="camera" size={40} className="text-accent/60" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/75 via-black/25 to-transparent p-4 pt-16">
          {eyebrow ? (
            <p className="text-2xs font-medium uppercase tracking-wide text-white/70">{eyebrow}</p>
          ) : null}
          <p className="font-display text-xl font-medium text-white drop-shadow-sm">
            {item.title}
          </p>
          <p className="text-sm text-white/85">
            {[
              item.placeName,
              item.dateYmd ? formatWallDate(item.dateYmd, "long") : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 p-4">
        <ScorePill score={item.coupleScore} size="lg" />
        <RevisitTag revisit={item.revisit} />
        {item.memorySnippet ? (
          <p className="mt-1 w-full text-sm leading-relaxed text-muted">“{item.memorySnippet}”</p>
        ) : null}
        <span className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
          Open date
          <Icon name="arrowRight" size={14} />
        </span>
      </div>
    </Link>
  );
}
