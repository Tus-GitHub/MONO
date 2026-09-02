"use client";

import { startTransition, useActionState, useState } from "react";
import { useRouter } from "next/navigation";

import { idleState, type ActionState } from "@/lib/utils/result";
import { toggleMemoryFavoriteAction } from "@/server/actions/memories";
import { togglePhotoFavoriteAction } from "@/server/actions/photos";
import { cn } from "@/lib/utils/cn";

type Data = { favorite: boolean };

/** A heart toggle for a memory or a photo. Optimistic; reconciles with the server result. */
export function FavoriteHeart({
  kind,
  id,
  dateId,
  isFavorite,
  size = 16,
  variant = "plain",
  className,
  label,
}: {
  kind: "memory" | "photo";
  id: string;
  dateId?: string;
  isFavorite: boolean;
  size?: number;
  /** `overlay` styles for sitting on top of a photo (dark scrim, white idle state). */
  variant?: "plain" | "overlay";
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const action = kind === "memory" ? toggleMemoryFavoriteAction : togglePhotoFavoriteAction;
  const [state, dispatch] = useActionState<ActionState<Data>, FormData>(action, idleState);
  const [optimistic, setOptimistic] = useState(isFavorite);
  const [seen, setSeen] = useState<ActionState<Data>>(idleState);

  if (state !== seen) {
    setSeen(state);
    if (state.status === "success" && state.data) {
      setOptimistic(state.data.favorite);
      router.refresh();
    } else if (state.status === "error") {
      setOptimistic(isFavorite);
    }
  }

  const toggle = () => {
    setOptimistic((value) => !value);
    const fd = new FormData();
    fd.set(kind === "memory" ? "memoryId" : "photoId", id);
    if (dateId) fd.set("dateId", dateId);
    startTransition(() => dispatch(fd));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={optimistic}
      aria-label={label ?? (optimistic ? "Remove from favourites" : "Add to favourites")}
      className={cn(
        "inline-flex items-center justify-center rounded-full transition-colors",
        variant === "overlay"
          ? cn(
              "backdrop-blur-sm",
              optimistic
                ? "bg-ink/45 text-primary"
                : "bg-ink/45 text-white/85 hover:bg-ink/60 hover:text-white",
            )
          : optimistic
            ? "text-primary"
            : "text-muted hover:text-primary",
        className,
      )}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={optimistic ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 19.5S4 14.5 4 9.2A4.2 4.2 0 0 1 8.2 5c1.9 0 3.1 1 3.8 2.1C12.7 6 13.9 5 15.8 5A4.2 4.2 0 0 1 20 9.2c0 5.3-8 10.3-8 10.3Z" />
      </svg>
      {label ? <span className="ml-1.5 text-sm font-medium">{label}</span> : null}
    </button>
  );
}
