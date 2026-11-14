"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { ImageCropDialog } from "@/components/uploads/image-crop-dialog";
import { COUPLE_PHOTO_ASPECT } from "@/lib/images/crop";
import { downscaleImage } from "@/lib/images/client-resize";
import { IMAGE_UPLOAD, validateImageRequest } from "@/lib/storage/image-rules";
import { useAsyncTask } from "@/lib/hooks/use-async-task";
import { uploadImageRequest } from "@/lib/images/upload-request";
import { cn } from "@/lib/utils/cn";

type Shape = "circle" | "cover";

interface ImageUploadProps {
  /** Route that accepts multipart POST (field `file`) and DELETE. Returns `{ url }`. */
  endpoint: string;
  value?: string | null;
  onChange?: (url: string | null) => void;
  shape?: Shape;
  label?: string;
  hint?: string;
  className?: string;
}


export function ImageUpload({
  endpoint,
  value = null,
  onChange,
  shape = "circle",
  label = "Photo",
  hint,
  className,
}: ImageUploadProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFile = useRef<File | null>(null);
  const [cropFiles, setCropFiles] = useState<File[] | null>(null);

  const task = useAsyncTask<{ url: string | null }, "uploading" | "removing">();
  const { run: runTask } = task;
  const status = task.state.status === "pending" ? task.state.phase : task.state.status;
  const error = task.state.status === "error" ? task.state.message : null;
  const canRetry = task.state.status === "error" && task.state.phase === "uploading";
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const shown = preview ?? value;
  const hasImage = Boolean(value);

  const upload = useCallback(async (input: File) => {
    const outcome = await runTask("uploading", async (signal) => {
      lastFile.current = input;
      setProgress(0);
      const file = await downscaleImage(input);
      signal.throwIfAborted();
      const check = validateImageRequest({ type: file.type, size: file.size });
      if (!check.ok) throw new Error(check.message);
      setPreview(URL.createObjectURL(file));
      try {
        const response = await uploadImageRequest<{ url: string }>(endpoint, file, signal, setProgress);
        if (typeof response?.url !== "string") throw new Error("Upload succeeded but the response was unreadable.");
        return response;
      } finally { if (!signal.aborted) setPreview(null); }
    });
    if (outcome) { onChange?.(outcome.data.url); router.refresh(); }
  }, [runTask, endpoint, onChange, router]);

  const select = (file: File) => {
    if (status === "uploading" || status === "removing" || cropFiles) return;
    task.reset();
    setCropFiles([file]);
  };

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) select(file);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) select(file);
  };

  const remove = async () => {
    const outcome = await runTask("removing", async (signal) => {
      const response = await fetch(endpoint, { method: "DELETE", signal });
      if (!response.ok) throw new Error("Couldn't remove the photo.");
      return { url: null };
    });
    if (outcome) { onChange?.(null); router.refresh(); }
  };

  const frame =
    shape === "circle"
      ? "size-24 rounded-full"
      : "w-full max-w-sm rounded-xl";

  return (
    <div className={cn("space-y-2", className)} data-uploading={Boolean(cropFiles) || status === "uploading" || status === "removing" || undefined}>
      {label ? <p className="text-sm font-medium text-ink">{label}</p> : null}

      <div className="flex flex-wrap items-center gap-4">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          style={shape === "cover" ? { aspectRatio: COUPLE_PHOTO_ASPECT } : undefined}
          className={cn(
            "relative grid shrink-0 place-items-center overflow-hidden border border-line bg-surface text-faint",
            frame,
            dragging && "border-primary ring-2 ring-ring/30",
          )}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className={cn("absolute inset-0 size-full", shape === "cover" ? "object-contain" : "object-cover")} />
          ) : (
            <Icon name={shape === "circle" ? "user" : "images"} size="lg" />
          )}

          {status === "uploading" ? (
            <div className="absolute inset-0 grid place-items-center bg-ink/50 text-primary-fg">
              <div className="flex flex-col items-center gap-1">
                <Spinner size="sm" className="text-primary-fg" />
                <span className="text-2xs font-medium">{progress}%</span>
              </div>
            </div>
          ) : null}
          {status === "removing" ? (
            <div className="absolute inset-0 grid place-items-center bg-ink/50 text-primary-fg">
              <Spinner size="sm" className="text-primary-fg" />
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={status === "uploading" || status === "removing"}
              onClick={() => inputRef.current?.click()}
              leadingIcon={<Icon name={hasImage ? "refresh" : "upload"} size="sm" />}
            >
              {hasImage ? "Replace" : "Upload"}
            </Button>
            {hasImage ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={status === "uploading" || status === "removing"}
                onClick={remove}
                leadingIcon={<Icon name="trash" size="sm" />}
              >
                Remove
              </Button>
            ) : null}
            {status === "error" && canRetry ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => lastFile.current && void upload(lastFile.current)}
              >
                Retry
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted">
            {hint ?? `JPEG, PNG, WebP or GIF · up to ${Math.round(IMAGE_UPLOAD.maxBytes / 1024 / 1024)} MB`}
          </p>
          {error ? <p className="text-xs text-error">{error}</p> : null}
        </div>
      </div>

      {status === "uploading" ? (
        <div className="h-1 w-full max-w-sm overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-fast"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_UPLOAD.accept.join(",")}
        className="hidden"
        onChange={onPick}
      />
      {cropFiles ? <ImageCropDialog files={cropFiles} shape={shape} onCancel={() => setCropFiles(null)}
        onConfirm={([file]) => { setCropFiles(null); void upload(file); }} /> : null}
    </div>
  );
}
