"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { useRouter } from "next/navigation";

import { Portal, useEscapeKey, useScrollLock } from "@/components/ui/_dialog-primitives";
import { Icon } from "@/components/ui/icon";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { PhotoView } from "@/lib/date/photo-view";
import { idleState } from "@/lib/utils/result";
import { cn } from "@/lib/utils/cn";
import {
  deleteDatePhotoAction,
  setBestCouplePhotoAction,
  setPhotoCaptionAction,
} from "@/server/actions/photos";

const SWIPE_THRESHOLD = 70;
const MAX_SCALE = 4;

export function PhotoLightbox({
  photos,
  index,
  dateId,
  onIndex,
  onClose,
}: {
  photos: PhotoView[];
  index: number;
  dateId: string;
  onIndex: (next: number) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [, captionAction] = useActionState(setPhotoCaptionAction, idleState);
  const [, bestAction] = useActionState(setBestCouplePhotoAction, idleState);

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [swipeX, setSwipeX] = useState(0);
  const [editing, setEditing] = useState(false);
  const [interacting, setInteracting] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gesture = useRef<
    | { kind: "swipe"; startX: number }
    | { kind: "pan"; startX: number; startY: number; from: { x: number; y: number } }
    | { kind: "pinch"; startDist: number; startScale: number }
    | null
  >(null);

  const photo = photos[index];
  const count = photos.length;

  const reset = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    setSwipeX(0);
    setEditing(false);
  }, []);

  const go = useCallback(
    (delta: number) => {
      if (count === 0) return;
      const next = (index + delta + count) % count;
      onIndex(next);
      reset();
    },
    [count, index, onIndex, reset],
  );

  useEscapeKey(onClose, true);
  useScrollLock(true);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
      else if (event.key === "0") reset();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, reset]);

  if (!photo) return null;

  const dist = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setInteracting(true);

    if (pointers.current.size === 2) {
      gesture.current = { kind: "pinch", startDist: dist(), startScale: scale };
    } else if (scale > 1) {
      gesture.current = {
        kind: "pan",
        startX: event.clientX,
        startY: event.clientY,
        from: { ...pan },
      };
    } else {
      gesture.current = { kind: "swipe", startX: event.clientX };
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    if (!g) return;

    if (g.kind === "pinch" && pointers.current.size === 2) {
      const factor = dist() / g.startDist;
      setScale(Math.min(MAX_SCALE, Math.max(1, g.startScale * factor)));
    } else if (g.kind === "pan") {
      setPan({
        x: g.from.x + (event.clientX - g.startX),
        y: g.from.y + (event.clientY - g.startY),
      });
    } else if (g.kind === "swipe") {
      setSwipeX(event.clientX - g.startX);
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    const g = gesture.current;

    if (g?.kind === "swipe") {
      if (swipeX <= -SWIPE_THRESHOLD) go(1);
      else if (swipeX >= SWIPE_THRESHOLD) go(-1);
      else setSwipeX(0);
    }
    if (g?.kind === "pinch" && scale <= 1.05) reset();
    if (pointers.current.size === 0) {
      gesture.current = null;
      setInteracting(false);
    }
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && Math.abs(event.deltaY) < 4) return;
    const next = Math.min(MAX_SCALE, Math.max(1, scale - event.deltaY * 0.003));
    setScale(next);
    if (next === 1) setPan({ x: 0, y: 0 });
  };

  const toggleZoom = () => {
    if (scale > 1) reset();
    else setScale(2.5);
  };

  const runCaption = (formData: FormData) => {
    captionAction(formData);
    setEditing(false);
    setTimeout(() => router.refresh(), 150);
  };

  const setBest = () => {
    const fd = new FormData();
    fd.set("dateId", dateId);
    fd.set("photoId", photo.isBest ? "" : photo.id);
    bestAction(fd);
    setTimeout(() => router.refresh(), 150);
  };

  const remove = async () => {
    const ok = await confirm({
      title: "Delete this photo?",
      description: "It's removed from the date and your storage.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set("dateId", dateId);
    fd.set("photoId", photo.id);
    await deleteDatePhotoAction(idleState, fd);
    if (count <= 1) onClose();
    else {
      onIndex(Math.min(index, count - 2));
      reset();
    }
    router.refresh();
  };

  const zoomed = scale > 1;

  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Photo ${index + 1} of ${count}`}
        className="fixed inset-0 z-50 flex flex-col bg-ink/95 backdrop-blur-sm"
      >
        {/* top chrome */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-white/90">
          <span className="text-xs font-medium tabular-nums">
            {index + 1} / {count}
          </span>
          <div className="flex items-center gap-1">
            <ChromeButton
              label={photo.isBest ? "This is your best photo" : "Make this the best photo"}
              active={photo.isBest}
              onClick={setBest}
            >
              <Icon name="star" size={17} />
            </ChromeButton>
            <ChromeButton label="Edit caption" onClick={() => setEditing((v) => !v)}>
              <Icon name="pencil" size={16} />
            </ChromeButton>
            <ChromeButton label={zoomed ? "Reset zoom" : "Zoom in"} onClick={toggleZoom}>
              <Icon name="search" size={16} />
            </ChromeButton>
            <ChromeButton label="Delete photo" onClick={remove}>
              <Icon name="trash" size={16} />
            </ChromeButton>
            <ChromeButton label="Close" onClick={onClose}>
              <Icon name="x" size={18} />
            </ChromeButton>
          </div>
        </div>

        {/* stage */}
        <div
          ref={stageRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onDoubleClick={toggleZoom}
          className={cn(
            "relative flex-1 touch-none select-none overflow-hidden",
            zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={photo.id}
            src={zoomed ? photo.fullUrl : photo.displayUrl}
            alt={photo.caption ?? ""}
            draggable={false}
            style={{
              transform: `translate3d(${pan.x + swipeX}px, ${pan.y}px, 0) scale(${scale})`,
              transition: interacting ? "none" : "transform 220ms ease-out",
            }}
            className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
          />

          {count > 1 && !zoomed ? (
            <>
              <EdgeButton side="left" onClick={() => go(-1)} />
              <EdgeButton side="right" onClick={() => go(1)} />
            </>
          ) : null}
        </div>

        {/* caption */}
        <div className="min-h-12 px-4 py-3 text-center text-sm text-white/85">
          {editing ? (
            <form action={runCaption} className="mx-auto flex max-w-md gap-2">
              <input type="hidden" name="dateId" value={dateId} />
              <input type="hidden" name="photoId" value={photo.id} />
              <input
                name="caption"
                defaultValue={photo.caption ?? ""}
                placeholder="Add a caption"
                autoFocus
                className="h-9 flex-1 rounded-lg border border-white/25 bg-white/10 px-3 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
              />
              <button
                type="submit"
                className="rounded-lg bg-white/15 px-3 text-xs font-medium text-white hover:bg-white/25"
              >
                Save
              </button>
            </form>
          ) : photo.caption ? (
            <p>{photo.caption}</p>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-white/50 hover:text-white/80"
            >
              Add a caption
            </button>
          )}
        </div>

        {/* preload neighbours */}
        {count > 1 ? (
          <div className="hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[(index + 1) % count].displayUrl} alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[(index - 1 + count) % count].displayUrl} alt="" />
          </div>
        ) : null}
      </div>
    </Portal>
  );
}

function ChromeButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid size-9 place-items-center rounded-lg transition-colors",
        active ? "bg-white/20 text-rating" : "text-white/80 hover:bg-white/12 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function EdgeButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
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
