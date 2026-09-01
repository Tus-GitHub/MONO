import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";
import type { DateRecommendation } from "@/server/services/recommendation-service";

export function RecommendedNext({ items }: { items: DateRecommendation[] }) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-medium text-ink">An idea for next time</h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-tint text-accent">
              <Icon name="sparkles" size="sm" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{item.title}</p>
              <p className="text-xs text-muted">{item.reason}</p>
            </div>
            <LinkButton
              href={
                item.placeId
                  ? `/plan?place=${item.placeId}`
                  : `/plan?idea=${encodeURIComponent(item.title)}`
              }
              variant="ghost"
              size="sm"
            >
              Plan this
            </LinkButton>
          </li>
        ))}
      </ul>
    </section>
  );
}
