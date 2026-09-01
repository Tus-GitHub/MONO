import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { Photo } from "@/components/ui/photo";
import { PLACE_CATEGORY_VIBE } from "@/lib/date/place-category";
import type { CoupleStatsView } from "@/server/services/home-service";

function Tile({
  icon,
  value,
  label,
}: {
  icon: IconName;
  value: ReactNode;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <span className="grid size-8 place-items-center rounded-lg bg-primary-tint text-primary">
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
        <Tile icon="calendarCheck" value={stats.datesTogether} label="dates together" />
        <Tile icon="mapPin" value={stats.placesVisited} label="places you've been" />
        <Tile icon="compass" value={stats.citiesExplored} label="cities explored" />
        <Tile
          icon="star"
          value={stats.averageScore10 != null ? stats.averageScore10.toFixed(1) : "—"}
          label="how you rate them"
        />
        <Tile
          icon="sparkles"
          value={
            stats.favoriteCategory ? PLACE_CATEGORY_VIBE[stats.favoriteCategory] : "Still finding out"
          }
          label="your kind of date"
        />
        <Tile icon="images" value={stats.memoriesKept} label="memories kept" />
      </div>
    </section>
  );
}
