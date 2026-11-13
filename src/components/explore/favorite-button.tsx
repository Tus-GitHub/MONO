"use client";

import { useOptimisticTask } from "@/lib/hooks/use-optimistic-task";

import { Icon } from "@/components/ui/icon";
import { toggleFavoriteAction } from "@/server/actions/place";
import { cn } from "@/lib/utils/cn";

interface PlaceRef {
  savedPlaceId: string | null;
  external: { provider: string; providerPlaceId: string } | null;
  name: string;
  category: string;
  address: string | null;
  city: string | null;
}

export function FavoriteButton({
  place,
  initialFavorite,
  className,
}: {
  place: PlaceRef;
  initialFavorite: boolean;
  className?: string;
}) {
  const task = useOptimisticTask(initialFavorite);
  const favorite = task.value;
  const pending = task.pending;
  const submit = async () => {
    await task.run(!favorite, async () => {
      const fd = new FormData();
      if (place.savedPlaceId) {
        fd.set("mode", "saved");
        fd.set("savedPlaceId", place.savedPlaceId);
      } else if (place.external) {
        fd.set("mode", "external");
        fd.set("provider", place.external.provider);
        fd.set("providerPlaceId", place.external.providerPlaceId);
      } else {
        fd.set("mode", "custom");
        fd.set("name", place.name);
        fd.set("category", place.category);
        if (place.address) fd.set("address", place.address);
        if (place.city) fd.set("city", place.city);
      }
      const result = await toggleFavoriteAction({ status: "idle" }, fd);
      if (result.status !== "success" || !result.data) throw new Error(result.status === "error" ? result.message : "Couldn't save favourite.");
      return result.data.favorite;
    });
  };

  return (
    <button
      type="button"
      onClick={submit}
      disabled={pending}
      aria-pressed={favorite}
      aria-label={favorite ? "Remove from favourites" : "Save to favourites"}
      className={cn(
        "grid size-8 place-items-center rounded-full bg-elevated/90 text-muted shadow-sm backdrop-blur transition-colors hover:text-primary",
        favorite && "text-primary",
        className,
      )}
    >
      <Icon name="heart" size="sm" style={favorite ? { fill: "currentColor" } : undefined} />
    </button>
  );
}
