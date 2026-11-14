"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { downscaleImage } from "@/lib/images/client-resize";
import { IMAGE_UPLOAD, validateImageRequest } from "@/lib/storage/image-rules";
import { UploadQueue, canUploadTransition, type UploadStatus } from "@/lib/images/upload-queue";
import { cn } from "@/lib/utils/cn";

type ItemStatus = UploadStatus;

interface UploadItem {
  id: string;
  file: File;
  previewUrl: string;
  status: ItemStatus;
  progress: number;
  error?: string;
  xhr?: XMLHttpRequest;
}

/** At most this many photos resize + upload at once — the rest wait, so a 20-photo drop
 *  never stalls the tab with parallel canvas work and connections. */
const MAX_CONCURRENT = 3;

let seq = 0;

export function PhotoUploader({
  dateId,
  onComplete,
}: {
  dateId: string;
  onComplete?: () => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const pickRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const itemsRef = useRef(items);
  const [queue] = useState(() => new UploadQueue<File>(MAX_CONCURRENT, async () => { }));

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => () => {
    queue.cancelAll();
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    for (const item of itemsRef.current) URL.revokeObjectURL(item.previewUrl);
  }, [queue]);

  const patch = useCallback((id: string, next: Partial<UploadItem>) => {
    setItems((list) => list.map((item) => item.id === id && (!next.status || canUploadTransition(item.status, next.status)) ? { ...item, ...next } : item));
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    const flush = () => {
      if (itemsRef.current.some((item) => ["queued", "preparing", "uploading"].includes(item.status))) { refreshTimer.current = setTimeout(flush, 500); return; }
      (onComplete ?? (() => router.refresh()))();
    };
    refreshTimer.current = setTimeout(flush, 500);
  }, [onComplete, router]);

  const processOne = useCallback(async (id: string, input: File, signal: AbortSignal) => {
    if (signal.aborted) return;
    patch(id, { status: "preparing" });
    try {
      const file = await downscaleImage(input).catch(() => input);
      if (signal.aborted) return;
      const check = validateImageRequest({ type: file.type, size: file.size });
      if (!check.ok) { patch(id, { status: "error", error: check.message }); return; }
      patch(id, { file });
      await new Promise<void>((resolve) => {
        const xhr = new XMLHttpRequest();
        const body = new FormData(); body.append("file", file);
        xhr.open("POST", `/api/uploads/date-photo?dateId=${encodeURIComponent(dateId)}`);
        xhr.timeout = 120_000;
        const finish = () => { signal.removeEventListener("abort", abort); resolve(); };
        const abort = () => { xhr.abort(); finish(); };
        signal.addEventListener("abort", abort, { once: true });
        xhr.upload.onprogress = (event) => {
          if (!signal.aborted && event.lengthComputable) patch(id, { progress: Math.round(event.loaded / event.total * 100) });
        };
        xhr.onload = () => {
          if (!signal.aborted) {
            if (xhr.status >= 200 && xhr.status < 300) {
              patch(id, { status: "done", progress: 100, xhr: undefined }); scheduleRefresh();
            } else {
              let message = xhr.status === 413 ? "That image is too large." : "Upload failed.";
              try { message = JSON.parse(xhr.responseText).error ?? message; } catch { /* Keep fallback. */ }
              patch(id, { status: "error", error: message, xhr: undefined });
            }
          }
          finish();
        };
        xhr.onerror = xhr.ontimeout = () => {
          if (!signal.aborted) patch(id, { status: "error", error: navigator.onLine ? "Upload failed — check your connection." : "You're offline.", xhr: undefined });
          finish();
        };
        xhr.onabort = finish;
        patch(id, { status: "uploading", progress: 0, error: undefined, xhr });
        try { xhr.send(body); } catch { xhr.onerror(new ProgressEvent("error")); }
      });
    } catch {
      if (!signal.aborted) patch(id, { status: "error", error: "Upload failed. Try again.", xhr: undefined });
    }
  }, [dateId, patch, scheduleRefresh]);

  useEffect(() => { queue.setWorker(processOne); }, [queue, processOne]);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const added = Array.from(fileList).filter((file) => file.type.startsWith("image/") || file.type === "").map((file) => ({
      id: `u${++seq}`, file, previewUrl: URL.createObjectURL(file), status: "queued" as ItemStatus, progress: 0,
    }));
    setItems((list) => [...list, ...added]);
    for (const item of added) queue.enqueue(item.id, item.file);
  }, [queue]);

  useEffect(() => {
    const onOnline = () => {
      for (const item of itemsRef.current) {
        if (item.status !== "error") continue;
        patch(item.id, { status: "queued", error: undefined, progress: 0 });
        queue.enqueue(item.id, item.file);
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [queue, patch]);

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setDragging(false);
    if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
  };
  const cancel = (item: UploadItem) => {
    queue.cancel(item.id);
    patch(item.id, { status: "canceled", xhr: undefined });
  };
  const retry = (item: UploadItem) => {
    if (item.status !== "error" && item.status !== "canceled") return;
    patch(item.id, { status: "queued", error: undefined, progress: 0 });
    queue.enqueue(item.id, item.file);
  };
  const remove = (item: UploadItem) => {
    queue.cancel(item.id); URL.revokeObjectURL(item.previewUrl);
    setItems((list) => list.filter((candidate) => candidate.id !== item.id));
  };
  const pending = (status: ItemStatus) => status === "queued" || status === "preparing" || status === "uploading";
  const clearFinished = () => {
    for (const item of itemsRef.current) if (!pending(item.status)) URL.revokeObjectURL(item.previewUrl);
    setItems((list) => list.filter((item) => pending(item.status)));
  };

  const busy = items.some((it) => pending(it.status));
  const finished = items.filter((it) => !pending(it.status)).length;

  return (
    <div className="space-y-3" data-uploading={busy || undefined}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => pickRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pickRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center gap-2 rounded-xl border border-dashed px-5 py-8 text-center transition-colors",
          dragging
            ? "border-primary bg-primary-tint/40"
            : "border-line-strong bg-surface/60 hover:border-primary/60",
        )}
      >
        <span className="grid size-11 place-items-center rounded-full bg-primary-tint text-primary">
          <Icon name="camera" size="sm" />
        </span>
        <p className="text-sm font-medium text-ink">Drop photos here, or choose from your device</p>
        <p className="text-xs text-muted">
          Several at once is fine · JPEG, PNG, WebP, AVIF or GIF · up to{" "}
          {Math.round(IMAGE_UPLOAD.maxBytes / 1024 / 1024)} MB each
        </p>
        <div className="mt-1 flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              pickRef.current?.click();
            }}
            leadingIcon={<Icon name="images" size="sm" />}
          >
            Choose photos
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              cameraRef.current?.click();
            }}
            leadingIcon={<Icon name="camera" size="sm" />}
          >
            Take a photo
          </Button>
        </div>
      </div>

      <input
        ref={pickRef}
        type="file"
        accept={IMAGE_UPLOAD.accept.join(",")}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewUrl}
                alt=""
                className="size-12 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ink">{item.file.name}</p>
                {item.status === "error" ? (
                  <p className="text-xs text-error">{item.error}</p>
                ) : item.status === "canceled" ? (
                  <p className="text-xs text-muted">Canceled</p>
                ) : item.status === "done" ? (
                  <p className="text-xs text-success">Added</p>
                ) : item.status === "queued" ? (
                  <p className="text-xs text-muted">Waiting…</p>
                ) : item.status === "preparing" ? (
                  <p className="text-xs text-muted">Preparing…</p>
                ) : (
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-fast"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {pending(item.status) ? (
                  <button
                    type="button"
                    onClick={() => cancel(item)}
                    className="rounded-md px-2 py-1 text-xs text-muted hover:text-ink"
                  >
                    Cancel
                  </button>
                ) : null}
                {item.status === "error" || item.status === "canceled" ? (
                  <button
                    type="button"
                    onClick={() => retry(item)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:text-primary-hover"
                  >
                    Retry
                  </button>
                ) : null}
                {!pending(item.status) ? (
                  <button
                    type="button"
                    aria-label="Remove from list"
                    onClick={() => remove(item)}
                    className="grid size-7 place-items-center rounded-md text-muted hover:bg-ink/[0.06] hover:text-ink"
                  >
                    <Icon name="x" size={13} />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {finished > 0 && !busy ? (
        <button
          type="button"
          onClick={clearFinished}
          className="text-xs text-muted transition-colors hover:text-ink"
        >
          Clear finished
        </button>
      ) : null}
    </div>
  );
}
