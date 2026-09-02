"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import Link from "next/link";

import { FavoriteHeart } from "@/components/memories/favorite-heart";
import { Portal, useBackButton, useEscapeKey, useScrollLock } from "@/components/ui/_dialog-primitives";
import { Icon } from "@/components/ui/icon";
import { Photo } from "@/components/ui/photo";
import type { WallPhoto } from "@/lib/date/photo-view";
import { formatWallDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const SWIPE = 64;

interface MorePage {
  photos: WallPhoto[];
  nextCursor: string | null;
}

export function PhotoWall({
  photos: initialPhotos,
  favoritable = false,
  nextCursor: initialCursor = null,
  loadMore,
}: {
  photos: WallPhoto[];
  favoritable?: boolean;
  nextCursor?: string | null;
  /** When provided with a cursor, the wall fetches further pages as it scrolls. */
  loadMore?: (cursor: string) => Promise<MorePage>;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [photos, setPhotos] = useState(initialPhotos);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  // De-dupe across pages (a photo can only appear once).
  const append = useCallback((incoming: WallPhoto[]) => {
    setPhotos((current) => {
      const seen = new Set(current.map((p) => p.id));
      return [...current, ...incoming.filter((p) => !seen.has(p.id))];
    });
  }, []);

  const fetchMore = useCallback(() => {
    if (!loadMore || !cursor || loading) return;
    setLoading(true);
    startTransition(async () => {
      try {
        const page = await loadMore(cursor);
        append(page.photos);
        setCursor(page.nextCursor);
      } finally {
        setLoading(false);
      }
    });
  }, [loadMore, cursor, loading, append]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !cursor || !loadMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchMore();
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [cursor, loadMore, fetchMore]);

  if (photos.length === 0) return null;

  return (
    <>
      <div className="columns-2 gap-2.5 sm:columns-3 lg:columns-4 [&>*]:mb-2.5">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpen(index)}
            aria-label={`Open photo from ${photo.dateTitle}`}
            className="cv-auto group relative block w-full overflow-hidden rounded-xl border border-line break-inside-avoid"
          >
            <Photo
              thumbUrl={photo.thumbUrl}
              displayUrl={photo.displayUrl}
              blurDataUrl={photo.blurDataUrl}
              width={photo.width}
              height={photo.height}
              alt={photo.caption ?? photo.dateTitle}
              sizes="(min-width: 1024px) 22vw, (min-width: 640px) 33vw, 50vw"
              className="transition-transform duration-slow ease-out group-hover:scale-[1.03]"
            />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/65 to-transparent p-2 pt-8 text-left text-2xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              {photo.dateTitle}
            </span>
            {photo.isFavorite ? (
              <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-ink/45 text-primary">
                <Icon name="heart" size={12} />
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {cursor && loadMore ? (
        <div ref={sentinel} className="flex justify-center py-4">
          <button
            type="button"
            onClick={fetchMore}
            disabled={loading}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-60"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}

      {open !== null ? (
        <WallViewer
          photos={photos}
          index={Math.min(open, photos.length - 1)}
          favoritable={favoritable}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}

function WallViewer({
  photos,
  index,
  favoritable,
  onIndex,
  onClose,
}: {
  photos: WallPhoto[];
  index: number;
  favoritable: boolean;
  onIndex: (next: number) => void;
  onClose: () => void;
}) {
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);
  const photo = photos[index];
  const count = photos.length;

  const go = useCallback(
    (delta: number) => {
      onIndex((index + delta + count) % count);
      setDx(0);
    },
    [count, index, onIndex],
  );

  useEscapeKey(onClose, true);
  useBackButton(onClose, true);
  useScrollLock(true);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go]);

  const down = (event: PointerEvent) => {
    // Ignore swipes that begin at the screen edge — those are the OS back/forward gesture.
    const w = typeof window === "undefined" ? 0 : window.innerWidth;
    startX.current = event.clientX > 24 && event.clientX < w - 24 ? event.clientX : null;
  };
  const move = (event: PointerEvent) => {
    if (startX.current != null) setDx(event.clientX - startX.current);
  };
  const up = () => {
    if (dx <= -SWIPE) go(1);
    else if (dx >= SWIPE) go(-1);
    else setDx(0);
    startX.current = null;
  };

  if (!photo) return null;

  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Photo ${index + 1} of ${count}`}
        className="fixed inset-0 z-50 flex flex-col bg-ink/95 backdrop-blur-sm"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-white/85">
          <span className="text-xs font-medium tabular-nums">
            {index + 1} / {count}
          </span>
          <div className="flex items-center gap-1">
            {favoritable ? (
              <span className="grid size-9 place-items-center text-white/85">
                <FavoriteHeart
                  kind="photo"
                  id={photo.id}
                  dateId={photo.dateId}
                  isFavorite={photo.isFavorite}
                  size={17}
                />
              </span>
            ) : null}
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="grid size-9 place-items-center rounded-lg text-white/85 hover:bg-white/12 hover:text-white"
            >
              <Icon name="x" size={18} />
            </button>
          </div>
        </div>

        <div
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className="relative flex-1 touch-none select-none overflow-hidden"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={photo.id}
            src={photo.displayUrl}
            alt={photo.caption ?? ""}
            draggable={false}
            style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
            className={cn(
              "absolute inset-0 m-auto max-h-full max-w-full object-contain",
              !dx && "transition-transform duration-base ease-out",
            )}
          />
          {count > 1 ? (
            <>
              <EdgeButton side="left" onClick={() => go(-1)} />
              <EdgeButton side="right" onClick={() => go(1)} />
            </>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{photo.dateTitle}</p>
            <p className="truncate text-xs text-white/70">
              {[
                photo.placeLabel,
                photo.dateYmd ? formatWallDate(photo.dateYmd, "long") : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <Link
            href={`/dates/${photo.dateId}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/12 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
          >
            Open date
            <Icon name="arrowRight" size={13} />
          </Link>
        </div>
      </div>
    </Portal>
  );
}

function EdgeButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Previous" : "Next"}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white/90 backdrop-blur-sm transition-colors hover:bg-white/20",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <Icon name={side === "left" ? "chevronLeft" : "chevronRight"} size={20} />
    </button>
  );
}
