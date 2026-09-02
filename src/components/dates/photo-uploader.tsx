"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { downscaleImage } from "@/lib/images/client-resize";
import { IMAGE_UPLOAD, validateImageUpload } from "@/lib/storage/image-rules";
import { cn } from "@/lib/utils/cn";

type ItemStatus = "queued" | "preparing" | "uploading" | "done" | "error" | "canceled";

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

  // --- imperative upload queue ---
  const queueRef = useRef<{ id: string; file: File }[]>([]);
  const activeRef = useRef(0);
  const canceledRef = useRef<Set<string>>(new Set());
  const pumpRef = useRef<() => void>(() => {});

  const patch = useCallback((id: string, next: Partial<UploadItem>) => {
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...next } : it)));
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      (onComplete ?? (() => router.refresh()))();
    }, 500);
  }, [onComplete, router]);

  const startUpload = useCallback(
    (id: string, file: File, onSettled: () => void) => {
      const body = new FormData();
      body.append("file", file);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/uploads/date-photo?dateId=${encodeURIComponent(dateId)}`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          patch(id, { progress: Math.round((event.loaded / event.total) * 100) });
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          patch(id, { status: "done", progress: 100, xhr: undefined });
          scheduleRefresh();
        } else {
          let message = xhr.status === 413 ? "That image is too large." : "Upload failed.";
          try {
            message = (JSON.parse(xhr.responseText) as { error?: string }).error ?? message;
          } catch {
            /* keep default */
          }
          patch(id, { status: "error", error: message, xhr: undefined });
        }
        onSettled();
      };
      xhr.onerror = () => {
        patch(id, {
          status: "error",
          error: navigator.onLine ? "Upload failed — check your connection." : "You're offline.",
          xhr: undefined,
        });
        onSettled();
      };
      xhr.onabort = () => {
        patch(id, { status: "canceled", xhr: undefined });
        onSettled();
      };
      patch(id, { status: "uploading", progress: 0, error: undefined, xhr });
      xhr.send(body);
    },
    [dateId, patch, scheduleRefresh],
  );

  const processOne = useCallback(
    async (id: string, file: File) => {
      const done = () => {
        activeRef.current = Math.max(0, activeRef.current - 1);
        pumpRef.current();
      };
      if (canceledRef.current.has(id)) {
        canceledRef.current.delete(id);
        done();
        return;
      }
      patch(id, { status: "preparing" });
      // Downscale first (iPhone HEIC → JPEG, 12 MP → ≤2560px, EXIF baked in), THEN validate —
      // so a camera capture that arrives as HEIC isn't rejected out of hand.
      const prepared = await downscaleImage(file).catch(() => file);
      if (canceledRef.current.has(id)) {
        canceledRef.current.delete(id);
        done();
        return;
      }
      const check = validateImageUpload({ type: prepared.type, size: prepared.size });
      if (!check.ok) {
        patch(id, { status: "error", error: check.message });
        done();
        return;
      }
      patch(id, { file: prepared });
      startUpload(id, prepared, done);
    },
    [patch, startUpload],
  );

  const pump = useCallback(() => {
    while (activeRef.current < MAX_CONCURRENT && queueRef.current.length > 0) {
      const task = queueRef.current.shift()!;
      activeRef.current += 1;
      void processOne(task.id, task.file);
    }
  }, [processOne]);

  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  const enqueue = useCallback(
    (id: string, file: File) => {
      queueRef.current.push({ id, file });
      pump();
    },
    [pump],
  );

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter(
        (f) => f.type.startsWith("image/") || f.type === "",
      );
      if (files.length === 0) return;

      const added = files.map((file) => {
        const id = `u${++seq}`;
        return {
          id,
          file,
          item: {
            id,
            file,
            previewUrl: URL.createObjectURL(file),
            status: "queued" as ItemStatus,
            progress: 0,
          } satisfies UploadItem,
        };
      });

      setItems((list) => [...list, ...added.map((a) => a.item)]);
      for (const { id, file } of added) enqueue(id, file);
    },
    [enqueue],
  );

  // Connection came back — re-queue anything that failed, without asking for the files again.
  useEffect(() => {
    const onOnline = () => {
      let any = false;
      setItems((list) =>
        list.map((it) => {
          if (it.status !== "error") return it;
          any = true;
          canceledRef.current.delete(it.id);
          queueRef.current.push({ id: it.id, file: it.file });
          return { ...it, status: "queued", error: undefined, progress: 0 };
        }),
      );
      if (any) pump();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [pump]);

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
  };

  const cancel = (item: UploadItem) => {
    if (item.xhr) {
      item.xhr.abort();
      return;
    }
    // Still queued or preparing — pull it before it starts.
    canceledRef.current.add(item.id);
    queueRef.current = queueRef.current.filter((t) => t.id !== item.id);
    patch(item.id, { status: "canceled" });
  };
  const retry = (item: UploadItem) => {
    canceledRef.current.delete(item.id);
    patch(item.id, { status: "queued", error: undefined, progress: 0 });
    enqueue(item.id, item.file);
  };
  const remove = (item: UploadItem) => {
    canceledRef.current.delete(item.id);
    queueRef.current = queueRef.current.filter((t) => t.id !== item.id);
    URL.revokeObjectURL(item.previewUrl);
    setItems((list) => list.filter((it) => it.id !== item.id));
  };
  const pending = (s: ItemStatus) =>
    s === "queued" || s === "preparing" || s === "uploading";
  const clearFinished = () => {
    setItems((list) => {
      list.forEach((it) => {
        if (!pending(it.status)) URL.revokeObjectURL(it.previewUrl);
      });
      return list.filter((it) => pending(it.status));
    });
  };

  const busy = items.some((it) => pending(it.status));
  const finished = items.filter((it) => !pending(it.status)).length;

  return (
    <div className="space-y-3">
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
