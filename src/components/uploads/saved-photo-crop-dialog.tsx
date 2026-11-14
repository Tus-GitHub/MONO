"use client";
import { useRef } from "react";
import { ImageCropDialog } from "./image-crop-dialog";
import type { SavedCropInfo, CropTarget } from "@/lib/images/saved-crop";
import type { PhotoView } from "@/lib/date/photo-view";
import type { MessageDTO } from "@/lib/together/types";

interface Result { url?: string; photo?: PhotoView; message?: MessageDTO }
export function SavedPhotoCropDialog({ kind, id, onSaved, onCancel, loadSource }: {
  kind: CropTarget; id?: string; onSaved: (result: Result) => void; onCancel: () => void;
  loadSource?: (info: SavedCropInfo, signal: AbortSignal) => Promise<Blob>;
}) {
  const session = useRef<SavedCropInfo | null>(null), result = useRef<Result>({});
  return <ImageCropDialog files={[]} shape={kind === "avatar" ? "circle" : kind === "couple" ? "cover" : "photo"}
    onCancel={onCancel} onConfirm={() => onSaved(result.current)} saved={{
      load: async (signal) => {
        const query = new URLSearchParams({ kind, ...(id ? { id } : {}) });
        const response = await fetch(`/api/photos/crop?${query}`, { signal, cache: "no-store" });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error ?? "Couldn't open this saved photo.");
        const info = value as SavedCropInfo; session.current = info;
        let blob: Blob;
        if (loadSource) blob = await loadSource(info, signal);
        else {
          const photo = await fetch(info.sourceUrl, { signal, credentials: "same-origin" });
          if (!photo.ok) throw new Error("This saved photo is no longer available.");
          blob = await photo.blob();
        }
        return { file: new File([blob], "saved-photo", { type: blob.type }), crop: info.crop };
      },
      save: async (crop, signal) => {
        if (!session.current) throw new Error("Open the photo before saving.");
        const response = await fetch("/api/photos/crop", { method: "PATCH", signal, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: { kind, ...(id ? { id } : {}) }, revision: session.current.revision, crop }) });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error ?? "Couldn't save the crop. Try again.");
        result.current = value;
      },
    }} />;
}
