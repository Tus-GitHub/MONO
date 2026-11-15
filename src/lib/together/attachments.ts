import { chatAAD, encryptBytes, encryptText, type ChatKey } from "./chat-crypto";
import { loadCropSource, exportCrop } from "@/lib/images/client-crop";
import type { SavedCrop } from "@/lib/images/saved-crop";
export const DOCUMENT_LIMIT = 2 * 1024 * 1024;
export const DOCUMENT_ACCEPT = ".pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.rtf";
export function attachmentName(name: string, fallback = "document.bin") {
  return Array.from(name).map((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || /[/\\<>:"|?*\u202a-\u202e\u2066-\u2069]/.test(char) ? "_" : char).join("").slice(0, 180) || fallback;
}
export function documentName(name: string) {
  const safe = attachmentName(name);
  return DOCUMENT_ACCEPT.split(",").includes("." + safe.split(".").at(-1)?.toLowerCase()) ? safe : `${safe}.bin`;
}
export async function photoForSaving(blob: Blob, crop: SavedCrop | null) {
  if (!crop) return blob;
  const signal = new AbortController().signal, file = new File([blob], "photo.jpg", { type: blob.type });
  const source = await loadCropSource(file, signal);
  try { return await exportCrop(source, file, { x: crop.x * source.width, y: crop.y * source.height, width: crop.width * source.width, height: crop.height * source.height }, signal); }
  finally { source.dispose(); }
}
export async function encryptDocument(file: File, key: ChatKey, coupleId: string, senderId: string, clientNonce: string) {
  const extension = "." + file.name.split(".").at(-1)?.toLowerCase();
  if (!DOCUMENT_ACCEPT.split(",").includes(extension)) throw new Error("Choose a PDF, text, spreadsheet, presentation or word-processing document.");
  if (!file.size || file.size > DOCUMENT_LIMIT) throw new Error("Choose a document up to 2 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  try { return { ...await encryptBytes(key, bytes, chatAAD(coupleId, senderId, clientNonce, "DOCUMENT_BYTES")), keyId: key.id, clientNonce,
    body: await encryptText(key, JSON.stringify({ name: attachmentName(file.name), size: file.size }), chatAAD(coupleId, senderId, clientNonce, "DOCUMENT")) }; }
  finally { bytes.fill(0); }
}
export function downloadAttachment(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.href = url; anchor.download = attachmentName(name); anchor.rel = "noopener"; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
/** Called from a fresh tap once bytes are loaded, preserving native share-sheet activation. */
export async function saveAttachment(blob: Blob, name: string) {
  const file = new File([blob], attachmentName(name), { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
  else downloadAttachment(blob, name);
}
