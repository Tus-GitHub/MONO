"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IMAGE_UPLOAD, validateImageUpload } from "@/lib/storage/image-rules";
import { cn } from "@/lib/utils/cn";

type ItemStatus = "uploading" | "done" | "error" | "canceled";

interface UploadItem {
  id: string;
  file: File;
  previewUrl: string;
  status: ItemStatus;
  progress: number;
  error?: string;
  xhr?: XMLHttpRequest;
}

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
    (id: string, file: File) => {
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
          let message = "Upload failed.";
          try {
            message = (JSON.parse(xhr.responseText) as { error?: string }).error ?? message;
          } catch {
            /* keep default */
          }
          patch(id, { status: "error", error: message, xhr: undefined });
        }
      };
      xhr.onerror = () => patch(id, { status: "error", error: "Network error.", xhr: undefined });
      xhr.onabort = () => patch(id, { status: "canceled", xhr: undefined });
      patch(id, { status: "uploading", progress: 0, error: undefined, xhr });
      xhr.send(body);
    },
    [dateId, patch, scheduleRefresh],
  );

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter(
        (f) => f.type.startsWith("image/") || f.type === "",
      );
      if (files.length === 0) return;

      const added = files.map((file) => {
        const check = validateImageUpload({ type: file.type, size: file.size });
        const id = `u${++seq}`;
        return {
          item: {
            id,
            file,
            previewUrl: URL.createObjectURL(file),
            status: (check.ok ? "uploading" : "error") as ItemStatus,
            progress: 0,
            error: check.ok ? undefined : check.message,
          } satisfies UploadItem,
          valid: check.ok,
        };
      });

      setItems((list) => [...list, ...added.map((a) => a.item)]);
      for (const { item, valid } of added) {
        if (valid) startUpload(item.id, item.file);
      }
    },
    [startUpload],
  );

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
  };

  const cancel = (item: UploadItem) => item.xhr?.abort();
  const retry = (item: UploadItem) => startUpload(item.id, item.file);
  const remove = (item: UploadItem) => {
    URL.revokeObjectURL(item.previewUrl);
    setItems((list) => list.filter((it) => it.id !== item.id));
  };
  const clearFinished = () => {
    setItems((list) => {
      list.forEach((it) => {
        if (it.status !== "uploading") URL.revokeObjectURL(it.previewUrl);
      });
      return list.filter((it) => it.status === "uploading");
    });
  };

  const busy = items.some((it) => it.status === "uploading");
  const finished = items.filter((it) => it.status !== "uploading").length;

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
                {item.status === "uploading" ? (
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
                {item.status !== "uploading" ? (
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
