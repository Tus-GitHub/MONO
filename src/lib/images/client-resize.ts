/**
 * Client-side downscale before upload — matters most on iPhone, where a single photo out of
 * the camera is routinely 3–8 MB (HEIC or 12 MP JPEG) and a cellular upload of the original
 * is slow and flaky. The server still re-encodes with sharp, so a modest quality drop here is
 * invisible in the result.
 *
 * Orientation: when we re-encode we pass `imageOrientation: "from-image"` so the pixels are
 * already upright — necessary because the canvas output carries no EXIF, and the server's
 * `sharp().rotate()` would then have nothing to correct. On the pass-through path the EXIF
 * stays on the original bytes and the server rotates it.
 *
 * Best-effort: if the browser can't decode the file (HEIC in a non-Safari browser, an option
 * bag it doesn't understand, anything else) the original `File` is returned and the server
 * handles it.
 */
const MAX_EDGE = 2560; // long edge, px — matches the server's "original" variant
const RESIZE_ABOVE_BYTES = 1_100_000; // don't bother re-encoding already-small images
const JPEG_QUALITY = 0.82; // keeps useful quality; the server re-encodes to WebP regardless

async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Older engines reject the options bag — fall back to a plain decode.
    return createImageBitmap(file);
  }
}

export async function downscaleImage(file: File): Promise<File> {
  if (typeof window === "undefined" || typeof createImageBitmap !== "function") return file;
  // Leave animations and vectors alone.
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
  if (file.size <= RESIZE_ABOVE_BYTES && file.type !== "image/heic" && file.type !== "image/heif") {
    return file;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await decode(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));

    // Already small enough and a format the server likes → keep the original bytes (its EXIF
    // orientation rides along and the server applies it).
    if (scale === 1 && file.type === "image/jpeg") {
      return file;
    }

    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
