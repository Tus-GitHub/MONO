"use client";

import { startTransition, useActionState, useState } from "react";
import { useRouter } from "next/navigation";

import { PhotoLightbox } from "@/components/dates/photo-lightbox";
import { PhotoUploader } from "@/components/dates/photo-uploader";
import { FavoriteHeart } from "@/components/memories/favorite-heart";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Photo } from "@/components/ui/photo";
import { useToast } from "@/components/ui/toast";
import type { PhotoView } from "@/lib/date/photo-view";
import { idleState, type ActionState } from "@/lib/utils/result";
import { cn } from "@/lib/utils/cn";
import { setBestCouplePhotoAction } from "@/server/actions/photos";

export function PhotoGallery({
  dateId,
  photos,
  canManage = true,
}: {
  dateId: string;
  photos: PhotoView[];
  canManage?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(photos.length === 0 && canManage);
  const [bestState, bestDispatch, bestPending] = useActionState(
    setBestCouplePhotoAction,
    idleState,
  );
  const [seen, setSeen] = useState<ActionState>(idleState);

  if (bestState !== seen) {
    setSeen(bestState);
    if (bestState.status === "success") {
      toast({ title: bestState.message ?? "Saved.", variant: "success" });
      router.refresh();
    } else if (bestState.status === "error") {
      toast({ title: bestState.message ?? "Couldn't update the best photo.", variant: "error" });
    }
  }

  const hasBest = photos.some((p) => p.isBest);

  const setBest = (photo: PhotoView) => {
    if (bestPending) return;
    const fd = new FormData();
    fd.set("dateId", dateId);
    fd.set("photoId", photo.isBest ? "" : photo.id);
    startTransition(() => bestDispatch(fd));
  };

  const layout =
    photos.length === 1
      ? "single"
      : photos.length === 2
        ? "pair"
        : "masonry";

  return (
    <section id="photos" className="scroll-mt-20 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-medium text-ink">
          Photos{photos.length > 0 ? ` · ${photos.length}` : ""}
        </h2>
        {canManage ? (
          <Button
            type="button"
            variant={adding ? "ghost" : "secondary"}
            size="sm"
            onClick={() => setAdding((v) => !v)}
            leadingIcon={<Icon name={adding ? "chevronUp" : "camera"} size="sm" />}
          >
            {adding ? "Done" : "Add photos"}
          </Button>
        ) : null}
      </div>

      {adding ? <PhotoUploader dateId={dateId} onComplete={() => router.refresh()} /> : null}

      {photos.length === 0 && !adding ? (
        <p className="rounded-xl border border-dashed border-line bg-surface/60 px-4 py-8 text-center text-sm text-muted">
          No photos yet.
        </p>
      ) : null}

      {photos.length > 0 && !hasBest ? (
        <div className="flex items-center gap-2 rounded-lg border border-accent/25 bg-accent-tint/50 px-3.5 py-2.5 text-sm text-accent">
          <Icon name="heart" size="sm" className="shrink-0" />
          <span>
            Pick the photo that feels most like you — tap{" "}
            <Icon name="star" size={13} className="mx-0.5 inline align-[-2px]" /> on your favourite.
          </span>
        </div>
      ) : null}

      {photos.length > 0 ? (
        <div
          className={cn(
            layout === "masonry" && "columns-2 gap-3 sm:columns-3 [&>*]:mb-3",
            layout === "pair" && "grid grid-cols-2 gap-3",
          )}
        >
          {photos.map((photo, i) => (
            <figure
              key={photo.id}
              className={cn(
                "group relative overflow-hidden rounded-xl border bg-surface",
                photo.isBest ? "border-primary ring-1 ring-primary/40" : "border-line",
                layout === "masonry" && "cv-auto break-inside-avoid",
              )}
            >
              <button
                type="button"
                onClick={() => setOpen(i)}
                aria-label={`Open photo ${i + 1}`}
                className="block w-full"
              >
                <Photo
                  thumbUrl={photo.thumbUrl}
                  displayUrl={photo.displayUrl}
                  blurDataUrl={photo.blurDataUrl}
                  width={photo.width}
                  height={photo.height}
                  aspect={layout === "single" ? undefined : layout === "pair" ? "1 / 1" : undefined}
                  alt={photo.caption ?? "Date photo"}
                  sizes={layout === "single" ? "100vw" : "(min-width: 640px) 33vw, 50vw"}
                  className="transition-transform duration-slow ease-out group-hover:scale-[1.02]"
                />
              </button>

              {canManage ? (
                <>
                  <button
                    type="button"
                    onClick={() => setBest(photo)}
                    disabled={bestPending}
                    aria-label={photo.isBest ? "Best couple photo — tap to unset" : "Set as best couple photo"}
                    aria-pressed={photo.isBest}
                    className={cn(
                      "absolute right-1.5 top-1.5 grid size-9 place-items-center rounded-full backdrop-blur-sm transition-[background-color,opacity] disabled:opacity-60",
                      photo.isBest
                        ? "bg-primary text-primary-fg"
                        : "bg-ink/45 text-white/85 opacity-0 hover:bg-ink/60 hover:text-white group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100",
                    )}
                  >
                    <Icon name="star" size={15} className={bestPending ? "animate-pulse" : undefined} />
                  </button>
                  <FavoriteHeart
                    kind="photo"
                    id={photo.id}
                    dateId={dateId}
                    isFavorite={photo.isFavorite}
                    variant="overlay"
                    size={15}
                    className={cn(
                      "absolute left-1.5 top-1.5 size-9",
                      photo.isFavorite
                        ? ""
                        : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100",
                    )}
                  />
                </>
              ) : null}

              {photo.isBest ? (
                <figcaption className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-ink/60 to-transparent px-2.5 py-2 text-2xs font-medium text-white">
                  Most like you
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      ) : null}

      {open !== null ? (
        <PhotoLightbox
          photos={photos}
          index={Math.min(open, photos.length - 1)}
          dateId={dateId}
          readOnly={!canManage}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </section>
  );
}
