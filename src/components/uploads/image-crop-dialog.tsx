"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { useAsyncTask } from "@/lib/hooks/use-async-task";
import { exportCrop, loadCropSource, type CropSource } from "@/lib/images/client-crop";
import { COUPLE_PHOTO_ASPECT, INITIAL_CROP, MAX_CROP_ZOOM, cropRect, panCrop, zoomCrop } from "@/lib/images/crop";
import { cn } from "@/lib/utils/cn";

type Shape = "circle" | "cover" | "photo";
const ASPECTS = [{ label: "Original", value: 0 }, { label: "Square", value: 1 }, { label: "Portrait", value: 3 / 4 }, { label: "Landscape", value: 3 / 2 }];

/** One shared editor for pickers, camera capture and drops. A batch uploads only after review. */
export function ImageCropDialog({ files, shape = "photo", onConfirm, onCancel }: {
  files: File[];
  shape?: Shape;
  onConfirm: (files: File[]) => void;
  onCancel: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [index, setIndex] = useState(0);
  const [source, setSource] = useState<CropSource | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [position, setPosition] = useState(INITIAL_CROP);
  const [selectedAspect, setSelectedAspect] = useState(0);
  const [fullPhoto, setFullPhoto] = useState(false);
  const prepared = useRef<File[]>([]);
  const confirmed = useRef<File[] | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const zoomId = useId();
  const hintId = useId();
  const task = useAsyncTask<File, "preparing">();
  const busy = task.state.status === "pending";
  const file = files[index];

  useEffect(() => {
    const controller = new AbortController();
    let loaded: CropSource | undefined;
    void loadCropSource(file, controller.signal).then((next) => {
      if (controller.signal.aborted) { next.dispose(); return; }
      loaded = next;
      setSource(next);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "Couldn't open this photo.");
    });
    return () => { controller.abort(); loaded?.dispose(); };
  }, [file]);

  const aspect = shape === "cover" ? COUPLE_PHOTO_ASPECT : shape === "circle" ? 1 : selectedAspect || (source ? source.width / source.height : 1);
  const crop = source ? fullPhoto ? { x: 0, y: 0, width: source.width, height: source.height } : cropRect(source, aspect, position) : null;
  const error = loadError ?? (task.state.status === "error" ? task.state.message : null);
  const close = () => { task.reset(); confirmed.current = null; setOpen(false); };
  const setZoom = (value: number) => {
    if (source && !busy && !fullPhoto) setPosition((current) => zoomCrop(source, aspect, current, value));
  };
  const movePointer = (event: PointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous || !source || busy || fullPhoto) return;
    const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)?.[1];
    const next = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, next);
    const frame = event.currentTarget.getBoundingClientRect();
    if (other) {
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      const after = Math.hypot(next.x - other.x, next.y - other.y);
      if (before > 0) setPosition((current) => zoomCrop(source, aspect, current, current.zoom * after / before));
    } else {
      setPosition((current) => panCrop(source, aspect, current, (next.x - previous.x) / frame.width, (next.y - previous.y) / frame.height));
    }
  };
  const apply = async () => {
    if (!source || !crop) return;
    const result = await task.run("preparing", (signal) => exportCrop(source, file, crop, signal));
    if (!result) return;
    prepared.current.push(result.data);
    if (index + 1 < files.length) {
      setSource(null); setLoadError(null); setPosition(INITIAL_CROP); setSelectedAspect(0); setFullPhoto(false);
      pointers.current.clear(); task.reset(); setIndex(index + 1);
    } else {
      confirmed.current = prepared.current;
      setOpen(false);
    }
  };

  return (
    <Modal open={open} onClose={close} className="image-crop-dialog" title={files.length > 1 ? `Adjust photo ${index + 1} of ${files.length}` : "Adjust photo"}
      description={shape === "cover" ? "This frame is used throughout your couple space." : shape === "circle" ? "Choose how your profile photo looks." : "Keep the whole photo or choose the part you want to share."}
      onHistoryClosed={(stayedOnPage) => { if (stayedOnPage && confirmed.current) onConfirm(confirmed.current); else onCancel(); }}
      footer={<>
        <Button variant="secondary" onClick={close}>Cancel</Button>
        <Button onClick={() => void apply()} disabled={!source || Boolean(loadError)} loading={busy}>
          {busy ? "Preparing…" : index + 1 < files.length ? "Next photo" : files.length > 1 ? `Use ${files.length} photos` : "Use photo"}
        </Button>
      </>}
    >
      <div className="space-y-4">
        {!source ? <div className="flex min-h-32 items-center justify-center gap-2 text-muted">{!loadError ? <><Spinner size="sm" /> Loading photo…</> : "Photo unavailable"}</div> : crop ? <>
          {shape === "cover" ? <div className="flex flex-wrap gap-2" role="group" aria-label="Couple photo framing">
            <Button size="sm" variant={fullPhoto ? "secondary" : "primary"} aria-pressed={!fullPhoto} disabled={busy} onClick={() => setFullPhoto(false)}>Fill frame</Button>
            <Button size="sm" variant={fullPhoto ? "primary" : "secondary"} aria-pressed={fullPhoto} disabled={busy} onClick={() => setFullPhoto(true)}>Full photo</Button>
          </div> : null}
          {shape === "photo" ? <div className="flex flex-wrap gap-2" role="group" aria-label="Photo shape">
            {ASPECTS.map((option) => <Button key={option.label} size="sm" variant={selectedAspect === option.value ? "primary" : "secondary"} aria-pressed={selectedAspect === option.value} disabled={busy}
              onClick={() => { setSelectedAspect(option.value); setPosition(INITIAL_CROP); }}>{option.label}</Button>)}
          </div> : null}
          <div className="flex justify-center rounded-xl bg-line p-2">
            <div role="group" aria-label="Photo crop preview" aria-describedby={hintId} tabIndex={busy ? -1 : 0}
              className={cn("image-crop-frame relative touch-none select-none overflow-hidden bg-surface outline-none focus-visible:ring-2 focus-visible:ring-ring", shape === "circle" ? "rounded-full" : "rounded-lg", busy ? "cursor-wait" : "cursor-grab active:cursor-grabbing")}
              style={{ "--crop-aspect": aspect } as CSSProperties}
              onPointerDown={(event) => {
                if (busy || fullPhoto || event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
              }}
              onPointerMove={movePointer}
              onPointerUp={(event) => pointers.current.delete(event.pointerId)}
              onPointerCancel={(event) => pointers.current.delete(event.pointerId)}
              onLostPointerCapture={(event) => pointers.current.delete(event.pointerId)}
              onKeyDown={(event) => {
                const moves: Record<string, [number, number]> = { ArrowLeft: [-0.04, 0], ArrowRight: [0.04, 0], ArrowUp: [0, -0.04], ArrowDown: [0, 0.04] };
                const delta = moves[event.key];
                if (delta && !busy && !fullPhoto) { event.preventDefault(); setPosition((current) => panCrop(source, aspect, current, ...delta)); }
              }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local, temporary image, same decoded pixels as export */}
              <img src={source.url} alt="" draggable={false} className={cn("pointer-events-none absolute max-w-none", fullPhoto && "object-contain")}
                style={fullPhoto ? { width: "100%", height: "100%", left: 0, top: 0 } : { width: `${source.width / crop.width * 100}%`, height: `${source.height / crop.height * 100}%`, left: `${-crop.x / crop.width * 100}%`, top: `${-crop.y / crop.height * 100}%` }} />
              {!fullPhoto ? <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }, (_, cell) => <span key={cell} className="border border-primary-fg/20" />)}
              </div> : null}
            </div>
          </div>
          <p id={hintId} className="text-xs text-muted">{fullPhoto ? "Your whole photo will fit inside the frame, with space around it." : "Drag to position. Pinch or use Zoom. Arrow keys move the photo."}</p>
          {!fullPhoto ? <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={zoomId} className="text-sm font-medium">Zoom · {Math.round(position.zoom * 100)}%</label>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setPosition(INITIAL_CROP)}>Reset</Button>
            </div>
            <input id={zoomId} type="range" aria-label="Zoom" min={1} max={MAX_CROP_ZOOM} step={0.01} value={position.zoom} disabled={busy}
              onChange={(event) => setZoom(Number(event.target.value))} className="min-h-9 w-full cursor-pointer accent-primary" />
          </div> : null}
        </> : null}
        {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
      </div>
    </Modal>
  );
}
