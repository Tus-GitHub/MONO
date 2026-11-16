"use client";
import { chatAAD, encryptBytes, encryptText, decryptBytes, type ChatKey } from "./chat-crypto";
import { togetherFetch } from "./client";
import { attachmentName } from "./attachments";
import { VIDEO_CHUNK_BYTES, VIDEO_MAX_BYTES, videoChunkCount, videoChunkAAD } from "./video-policy";
import type { MessageDTO } from "./types";
export interface VideoUpload { nonce: string; body?: string; id?: string; index: number; pending?: { iv: string; data: string } }
export const newVideoUpload = (): VideoUpload => ({ nonce: crypto.randomUUID(), index: 0 });
async function retry<T>(work: () => Promise<T>, signal: AbortSignal) {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    try { return await work(); } catch (error) {
      if (signal.aborted || attempt >= 2) throw error;
      await new Promise<void>((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
    }
  }
}
export async function uploadVideo(file: File, state: VideoUpload, key: ChatKey, coupleId: string, userId: string, signal: AbortSignal, progress: (value: number) => void) {
  const count = videoChunkCount(file.size);
  state.body ??= await encryptText(key, JSON.stringify({ v: 1, name: attachmentName(file.name), size: file.size, type: file.type, chunkCount: count }), chatAAD(coupleId, userId, state.nonce, "VIDEO"));
  state.id ??= (await retry(() => togetherFetch<{ id: string }>("/api/together/videos", { signal, body: { action: "start", clientNonce: state.nonce, body: state.body, keyId: key.id, byteLength: file.size } }), signal)).id;
  for (; state.index < count; state.index++) {
    signal.throwIfAborted();
    if (!state.pending) {
      const bytes = new Uint8Array(await file.slice(state.index * VIDEO_CHUNK_BYTES, (state.index + 1) * VIDEO_CHUNK_BYTES).arrayBuffer());
      try { state.pending = await encryptBytes(key, bytes, chatAAD(coupleId, userId, state.nonce, videoChunkAAD(state.index, count))); }
      finally { bytes.fill(0); }
    }
    await retry(() => togetherFetch("/api/together/videos", { signal, body: { action: "part", id: state.id, index: state.index, ...state.pending } }), signal);
    state.pending = undefined;
    progress((state.index + 1) / count);
  }
  return retry(() => togetherFetch<MessageDTO>("/api/together/videos", { signal, body: { action: "finish", id: state.id } }), signal);
}
export function videoMetadata(body: string) {
  try {
    const m = JSON.parse(body);
    if (m.v !== 1 || typeof m.name !== "string" || typeof m.type !== "string" || !/^video\/[a-z0-9.+-]+$/.test(m.type) || !Number.isInteger(m.size) || m.size <= 0 || m.size > VIDEO_MAX_BYTES || m.chunkCount !== videoChunkCount(m.size)) return null;
    return { name: attachmentName(m.name), type: m.type as string, size: m.size as number, chunkCount: m.chunkCount as number };
  } catch { return null; }
}
export async function downloadVideo(message: MessageDTO, metadata: NonNullable<ReturnType<typeof videoMetadata>>, key: ChatKey, coupleId: string, signal: AbortSignal, progress: (value: number) => void) {
  const path = `/api/together/videos/${message.id}`;
  const manifest = await togetherFetch<{ chunkCount: number; byteLength: number }>(path, { signal });
  if (manifest.chunkCount !== metadata.chunkCount || manifest.byteLength !== metadata.size) throw new Error("Video metadata does not match its encrypted chunks.");
  const parts: Blob[] = [];
  for (let index = 0; index < metadata.chunkCount; index++) {
    const payload = await retry(() => togetherFetch<{ iv: string; data: string }>(`${path}?part=${index}`, { signal }), signal);
    const bytes = await decryptBytes(key, payload, chatAAD(coupleId, message.senderId, message.clientNonce, videoChunkAAD(index, metadata.chunkCount)));
    try {
      if (bytes.length !== Math.min(VIDEO_CHUNK_BYTES, metadata.size - index * VIDEO_CHUNK_BYTES)) throw new Error("Incomplete encrypted video.");
      parts.push(new Blob([new Uint8Array(bytes)]));
    } finally { bytes.fill(0); }
    progress((index + 1) / metadata.chunkCount);
  }
  signal.throwIfAborted();
  return new Blob(parts, { type: metadata.type });
}
