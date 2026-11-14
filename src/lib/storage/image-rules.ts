/**
 * Image upload constraints — pure, client-safe (no Node imports). Shared by the upload
 * routes and the browser file picker.
 */
export const IMAGE_UPLOAD = {
  maxBytes: 12 * 1024 * 1024,
  accept: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"] as const,
};

const MB = (n: number) => Math.round(n / 1024 / 1024);
// Keep multipart requests below Vercel Functions' 4.5 MB body limit, including form overhead.
export const IMAGE_REQUEST_MAX_BYTES = 4_000_000;

export function validateImageRequest(file: { type: string; size: number }) {
  const result = validateImageUpload(file);
  if (!result.ok) return result;
  return file.size <= IMAGE_REQUEST_MAX_BYTES ? result : { ok: false as const, message: "This image couldn't be resized enough. Choose an image under 4 MB." };
}

export function validateImageUpload(file: {
  type: string;
  size: number;
}): { ok: true } | { ok: false; message: string } {
  if (!IMAGE_UPLOAD.accept.includes(file.type as (typeof IMAGE_UPLOAD.accept)[number])) {
    return { ok: false, message: "Use a JPEG, PNG, WebP, AVIF, or GIF image." };
  }
  if (file.size > IMAGE_UPLOAD.maxBytes) {
    return { ok: false, message: `That image is over ${MB(IMAGE_UPLOAD.maxBytes)} MB.` };
  }
  if (file.size === 0) {
    return { ok: false, message: "That file is empty." };
  }
  return { ok: true };
}
