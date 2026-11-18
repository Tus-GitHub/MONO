import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { Photo } from "@/components/ui/photo";
import { PLACE_CATEGORY_VIBE } from "@/lib/date/place-category";
import type { CoupleStatsView } from "@/server/services/home-service";

function Tile({
  icon,
  value,
  label,
  tone = "primary",
}: {
  icon: IconName;
  value: ReactNode;
  label: string;
  tone?: "primary" | "accent" | "rating" | "success";
}) {
  const toneClass = {
    primary: "bg-primary-tint text-primary",
    accent: "bg-accent-tint text-accent",
    rating: "bg-rating/15 text-rating",
    success: "bg-success-tint text-success",
  }[tone];

  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-xs transition-[transform,box-shadow,border-color] duration-fast ease-out hover:-translate-y-0.5 hover:border-line-strong hover:shadow-sm">
      <span className={`grid size-8 place-items-center rounded-lg ${toneClass}`}>
        <Icon name={icon} size="sm" />
      </span>
      <p className="mt-3 font-display text-xl font-semibold text-ink">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

export function CoupleStats({ stats }: { stats: CoupleStatsView }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-medium text-ink">The two of you, so far</h2>
      {stats.heroPhoto ? (
        <Photo
          thumbUrl={stats.heroPhoto.thumbUrl}
          displayUrl={stats.heroPhoto.displayUrl}
          blurDataUrl={stats.heroPhoto.blurDataUrl}
          alt=""
          aspect="21 / 9"
          sizes="(min-width: 1024px) 640px, 100vw"
          className="rounded-2xl border border-line"
        />
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile icon="calendarCheck" value={stats.datesTogether} label="dates together" tone="primary" />
        <Tile icon="mapPin" value={stats.placesVisited} label="places you've been" tone="accent" />
        <Tile icon="compass" value={stats.citiesExplored} label="cities explored" tone="success" />
        <Tile
          icon="star"
          value={stats.averageScore10 != null ? stats.averageScore10.toFixed(1) : "—"}
          label="how you rate them"
          tone="rating"
        />
        <Tile
          icon="sparkles"
          value={
            stats.favoriteCategory ? PLACE_CATEGORY_VIBE[stats.favoriteCategory] : "Still finding out"
          }
          label="your kind of date"
          tone="accent"
        />
        <Tile icon="images" value={stats.memoriesKept} label="memories kept" tone="primary" />
      </div>
    </section>
  );
}
