"use client";

import { useActionState, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { idleState } from "@/lib/utils/result";
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
  const [state, dispatch, pending] = useActionState(toggleFavoriteAction, idleState);
  const [favorite, setFavorite] = useState(initialFavorite);
  const [lastSeen, setLastSeen] = useState<typeof state>(idleState);

  // Reconcile with the server result (render-phase adjustment, not an effect).
  if (state !== lastSeen) {
    setLastSeen(state);
    if (state.status === "success" && state.data) setFavorite(state.data.favorite);
  }

  const submit = () => {
    setFavorite((current) => !current); // optimistic
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
    dispatch(fd);
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
