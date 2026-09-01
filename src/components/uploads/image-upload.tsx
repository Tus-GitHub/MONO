"use client";

import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { IMAGE_UPLOAD, validateImageUpload } from "@/lib/storage/image-rules";
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

type Status = "idle" | "uploading" | "removing" | "error";

export function ImageUpload({
  endpoint,
  value = null,
  onChange,
  shape = "circle",
  label = "Photo",
  hint,
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const lastFile = useRef<File | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [canRetry, setCanRetry] = useState(false);

  const shown = preview ?? value;
  const hasImage = Boolean(value);

  const upload = useCallback(
    (file: File) => {
      const check = validateImageUpload({ type: file.type, size: file.size });
      if (!check.ok) {
        setStatus("error");
        setError(check.message);
        return;
      }

      lastFile.current = file;
      setError(null);
      setCanRetry(false);
      setStatus("uploading");
      setProgress(0);
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);

      const body = new FormData();
      body.append("file", file);

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open("POST", endpoint);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        URL.revokeObjectURL(objectUrl);
        setPreview(null);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText) as { url: string };
            setStatus("idle");
            setProgress(100);
            onChange?.(data.url);
          } catch {
            setStatus("error");
            setError("Upload succeeded but the response was unreadable.");
          }
        } else {
          let message = "Upload failed. Try again.";
          try {
            message = (JSON.parse(xhr.responseText) as { error?: string }).error ?? message;
          } catch {
            /* keep default */
          }
          setStatus("error");
          setError(message);
          setCanRetry(true);
        }
      };
      xhr.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setPreview(null);
        setStatus("error");
        setError("Network error during upload.");
        setCanRetry(true);
      };
      xhr.send(body);
    },
    [endpoint, onChange],
  );

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) upload(file);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) upload(file);
  };

  const remove = async () => {
    setStatus("removing");
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setStatus("idle");
      onChange?.(null);
    } catch {
      setStatus("error");
      setError("Couldn't remove the photo.");
    }
  };

  const frame =
    shape === "circle"
      ? "size-24 rounded-full"
      : "aspect-[3/2] w-full max-w-sm rounded-xl";

  return (
    <div className={cn("space-y-2", className)}>
      {label ? <p className="text-sm font-medium text-ink">{label}</p> : null}

      <div className="flex flex-wrap items-center gap-4">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "relative grid shrink-0 place-items-center overflow-hidden border border-line bg-surface text-faint",
            frame,
            dragging && "border-primary ring-2 ring-ring/30",
          )}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="size-full object-cover" />
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
                onClick={() => lastFile.current && upload(lastFile.current)}
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
    </div>
  );
}
