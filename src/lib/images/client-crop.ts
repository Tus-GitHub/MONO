import { IMAGE_UPLOAD, IMAGE_REQUEST_MAX_BYTES } from "@/lib/storage/image-rules";
import type { CropRect, ImageSize } from "@/lib/images/crop";

export interface CropSource extends ImageSize {
  image: HTMLImageElement;
  url: string;
  dispose: () => void;
}

/** Use the same browser-decoded, EXIF-oriented image for the preview and the saved pixels. */
export async function loadCropSource(file: File, signal: AbortSignal): Promise<CropSource> {
  if (!file.size) throw new Error("That file is empty.");
  if (file.size > IMAGE_UPLOAD.maxBytes) throw new Error("Choose an image under 12 MB.");
  const supported = [...IMAGE_UPLOAD.accept, "image/heic", "image/heif"] as string[];
  if (file.type ? !supported.includes(file.type) : !/\.(jpe?g|png|webp|avif|gif|hei[cf])$/i.test(file.name)) {
    throw new Error("Use a JPEG, PNG, WebP, AVIF, or GIF image.");
  }
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    const detach = () => {
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener("abort", abort);
    };
    const dispose = () => { detach(); image.src = ""; URL.revokeObjectURL(url); };
    const abort = () => { dispose(); reject(new DOMException("Cancelled", "AbortError")); };
    signal.addEventListener("abort", abort, { once: true });
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        dispose(); reject(new Error("That image couldn't be read. Choose another photo.")); return;
      }
      detach();
      resolve({ image, url, width: image.naturalWidth, height: image.naturalHeight, dispose });
    };
    image.onerror = () => { dispose(); reject(new Error("That image couldn't be read. Try a JPEG, PNG or WebP photo.")); };
    image.src = url;
  });
}

/** Only the selected rectangle leaves the device. Never silently upload the uncropped file. */
export async function exportCrop(source: CropSource, file: File, crop: CropRect, signal: AbortSignal): Promise<File> {
  signal.throwIfAborted();
  const canvas = document.createElement("canvas");
  const type = file.type === "image/jpeg" ? "image/jpeg" : "image/webp";
  try {
    for (const maxEdge of [2560, 1920, 1280]) {
      const scale = Math.min(1, maxEdge / Math.max(crop.width, crop.height));
      canvas.width = Math.max(1, Math.round(crop.width * scale));
      canvas.height = Math.max(1, Math.round(crop.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Photo editing isn't available in this browser.");
      context.drawImage(source.image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.9, 0.78, 0.6]) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
        signal.throwIfAborted();
        if (!blob) throw new Error("Couldn't prepare that photo. Please try again.");
        if (blob.size <= IMAGE_REQUEST_MAX_BYTES) {
          const extension = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
          return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-cropped.${extension}`, { type: blob.type, lastModified: Date.now() });
        }
      }
    }
    throw new Error("That photo is still too large. Try a smaller selection.");
  } finally {
    canvas.width = canvas.height = 0;
  }
}
