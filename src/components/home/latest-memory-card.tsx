import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";
import { Photo } from "@/components/ui/photo";
import { REVISIT_CHOICE_META } from "@/lib/date/revisit-choice";
import { formatDate } from "@/lib/utils/format";
import type { LatestMemoryView } from "@/server/services/home-service";

export function LatestMemoryCard({ memory }: { memory: LatestMemoryView }) {
  const revisit = memory.revisit ? REVISIT_CHOICE_META[memory.revisit] : null;

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-medium text-ink">Last time</h2>

      <article className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className="relative aspect-[3/2] w-full bg-line sm:aspect-[21/9]">
          {memory.cover ? (
            <Photo
              thumbUrl={memory.cover.thumbUrl}
              displayUrl={memory.cover.displayUrl}
              blurDataUrl={memory.cover.blurDataUrl}
              alt=""
              priority
              sizes="(min-width: 1024px) 640px, 100vw"
              className="absolute inset-0"
            />
          ) : (
            <div className="grid size-full place-items-center bg-linear-to-br from-accent-tint via-surface to-primary-tint">
              <Icon name="camera" size={40} className="text-accent/70" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 via-black/20 to-transparent p-4 pt-12">
            <p className="text-lg font-medium text-white drop-shadow-sm">{memory.title}</p>
            <p className="text-sm text-white/85">
              {[memory.placeName, memory.placeCity].filter(Boolean).join(", ")}
              {memory.completedAt ? ` · ${formatDate(memory.completedAt, "long")}` : ""}
            </p>
          </div>
        </div>

        <div className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-3">
            {memory.combinedScore10 != null ? (
              <span className="inline-flex items-baseline gap-1">
                <span className="font-display text-2xl font-semibold text-ink">
                  {memory.combinedScore10.toFixed(1)}
                </span>
                <span className="text-sm text-muted">/10 together</span>
              </span>
            ) : (
              <span className="text-sm text-muted">Not rated yet</span>
            )}
            {revisit ? (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${revisit.className}`}
              >
                <Icon name="refresh" size={12} />
                {revisit.label}
              </span>
            ) : null}
          </div>

          {memory.memoryCaption ? (
            <p className="line-clamp-3 text-sm leading-relaxed text-muted">
              “{memory.memoryCaption}”
            </p>
          ) : memory.hasMemory ? null : (
            <p className="text-sm text-muted">
              You haven&apos;t kept a memory from this one yet.
            </p>
          )}

          <LinkButton
            href={`/dates/${memory.dateId}`}
            variant="secondary"
            size="sm"
            trailingIcon={<Icon name="arrowRight" size="sm" />}
          >
            {memory.hasMemory ? "View memory" : "Add a memory"}
          </LinkButton>
        </div>
      </article>
    </section>
  );
}
