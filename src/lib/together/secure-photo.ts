import { CHAT_IMAGE_LIMIT } from "./catalog";
import { chatAAD, encryptBytes, type ChatKey } from "./chat-crypto";

// Re-encode on the device: the server must never decode a plaintext chat image.
export async function prepareSecurePhoto(file: Blob) {
  if (file.size > 25 * 1024 * 1024) throw new Error("Choose a photo smaller than 25 MB.");
  const url = URL.createObjectURL(file), image = new Image();
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("This photo format could not be opened. Try a JPEG or PNG.")); image.src = url; });
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser could not prepare the photo.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    let blob: Blob | null = null;
    for (const quality of [0.82, 0.65, 0.45, 0.25]) {
      blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= CHAT_IMAGE_LIMIT) break;
    }
    if (!blob || blob.size > CHAT_IMAGE_LIMIT) throw new Error("This photo is still too large. Crop it smaller and try again.");
    return { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
  } finally { image.src = ""; URL.revokeObjectURL(url); }
}
export async function encryptPhoto(file: Blob, key: ChatKey, coupleId: string, senderId: string, clientNonce: string, viewLimit: 0 | 1 | 2) {
  const photo = await prepareSecurePhoto(file);
  try {
    return { ...await encryptBytes(key, photo.bytes, chatAAD(coupleId, senderId, clientNonce, `IMAGE_BYTES:${viewLimit}`)), width: photo.width, height: photo.height, keyId: key.id, clientNonce, viewLimit };
  } finally { photo.bytes.fill(0); }
}
