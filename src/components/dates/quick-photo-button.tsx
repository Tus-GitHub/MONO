"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { downscaleImage } from "@/lib/images/client-resize";
import { IMAGE_UPLOAD, validateImageUpload } from "@/lib/storage/image-rules";
import { cn } from "@/lib/utils/cn";

/**
 * One-tap photo capture for a date. Uploads straight to the date-photo route (with progress),
 * then refreshes the page so the new picture shows up. Used in Day Mode and the photos section.
 */
export function QuickPhotoButton({
  dateId,
  variant = "secondary",
  size = "md",
  fullWidth = false,
  label = "Add photo",
  className,
}: {
  dateId: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = async (input: File) => {
    setError(null);
    setBusy(true);
    setProgress(0);
    // iPhone camera captures arrive as HEIC / 12 MP — transcode + shrink before the POST.
    const file = await downscaleImage(input);
    const check = validateImageUpload({ type: file.type, size: file.size });
    if (!check.ok) {
      setBusy(false);
      setError(check.message);
      return;
    }

    const body = new FormData();
    body.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/uploads/date-photo?dateId=${encodeURIComponent(dateId)}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      setBusy(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        router.refresh();
      } else {
        let message = "Upload failed. Try again.";
        try {
          message = (JSON.parse(xhr.responseText) as { error?: string }).error ?? message;
        } catch {
          /* keep default */
        }
        setError(message);
      }
    };
    xhr.onerror = () => {
      setBusy(false);
      setError("Network error during upload.");
    };
    xhr.send(body);
  };

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void upload(file);
  };

  return (
    <div className={cn(fullWidth && "w-full", className)}>
      <Button
        type="button"
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        loading={busy}
        onClick={() => inputRef.current?.click()}
        leadingIcon={busy ? undefined : <Icon name="camera" size="sm" />}
      >
        {busy ? `Uploading ${progress}%` : label}
      </Button>
      {error ? <p className="mt-1 text-xs text-error">{error}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_UPLOAD.accept.join(",")}
        capture="environment"
        className="hidden"
        onChange={onPick}
      />
    </div>
  );
}
