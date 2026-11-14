"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ImageCropDialog } from "@/components/uploads/image-crop-dialog";
import { downscaleImage } from "@/lib/images/client-resize";
import { IMAGE_UPLOAD, validateImageRequest } from "@/lib/storage/image-rules";
import { useAsyncTask } from "@/lib/hooks/use-async-task";
import { uploadImageRequest } from "@/lib/images/upload-request";
import { cn } from "@/lib/utils/cn";

/**
 * Photo capture with crop confirmation, upload progress and a refreshed date gallery.
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
  const task = useAsyncTask<unknown, "uploading">();
  const busy = task.state.status === "pending";
  const error = task.state.status === "error" ? task.state.message : null;
  const [progress, setProgress] = useState(0);
  const [cropFiles, setCropFiles] = useState<File[] | null>(null);

  const upload = async (input: File) => {
    const outcome = await task.run("uploading", async (signal) => {
      setProgress(0);
      const file = await downscaleImage(input);
      signal.throwIfAborted();
      const check = validateImageRequest({ type: file.type, size: file.size });
      if (!check.ok) throw new Error(check.message);
      return uploadImageRequest(`/api/uploads/date-photo?dateId=${encodeURIComponent(dateId)}`, file, signal, setProgress);
    });
    if (outcome) router.refresh();
  };

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file && !busy && !cropFiles) { task.reset(); setCropFiles([file]); }
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
      {cropFiles ? <ImageCropDialog files={cropFiles} onCancel={() => setCropFiles(null)}
        onConfirm={([file]) => { setCropFiles(null); void upload(file); }} /> : null}
    </div>
  );
}
