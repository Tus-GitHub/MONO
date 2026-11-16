import { STICKER_EDGE, STICKER_LIMIT, type PreparedSticker } from "./stickers";

/** Rasterize locally onto a transparent canvas. No original image is uploaded or decoded by the server. */
export async function prepareSticker(file: File): Promise<PreparedSticker> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Choose a PNG, JPEG or WebP image.");
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error("Choose an image smaller than 10 MB.");
  const url = URL.createObjectURL(file), image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve(); image.onerror = () => reject(new Error("This image could not be opened.")); image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error("Choose an image up to 40 megapixels.");
    for (const edge of [STICKER_EDGE, 384, 256]) {
      const canvas = document.createElement("canvas"); canvas.width = edge; canvas.height = edge;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser cannot prepare stickers.");
      const scale = Math.min(edge / image.naturalWidth, edge / image.naturalHeight);
      const width = Math.max(1, Math.round(image.naturalWidth * scale)), height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.drawImage(image, (edge - width) / 2, (edge - height) / 2, width, height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (blob && blob.size <= STICKER_LIMIT) return { id: crypto.randomUUID(), bytes: new Uint8Array(await blob.arrayBuffer()), width: edge, height: edge };
    }
    throw new Error("This image is too detailed for a sticker. Try a smaller or simpler image.");
  } finally { image.src = ""; URL.revokeObjectURL(url); }
}
