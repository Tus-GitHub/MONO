import { AUDIO_CHUNK_BYTES, AUDIO_LIMIT, MUSIC_LIMIT } from "./file";
import { togetherFetch } from "@/lib/together/client";
import type { MusicPreferences, MusicTrack } from "./playlist";
export interface AudioSettings extends MusicPreferences { ringtoneName: string | null; ringtoneVersion: string | null; music: MusicTrack | null; tracks: MusicTrack[] }
export const AUDIO_CHANGED = "mono:audio-settings";
export function audioChanged(settings: AudioSettings) { window.dispatchEvent(new CustomEvent(AUDIO_CHANGED, { detail: settings })); }
const encode = (bytes: Uint8Array) => {
  let binary = ""; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
};
export async function uploadAudio(file: File, action: "ringtone" | "music", onProgress?: (percent: number) => void): Promise<AudioSettings> {
  if (!file.size || file.size > (action === "music" ? MUSIC_LIMIT : AUDIO_LIMIT)) throw new Error(`Choose audio up to ${action === "music" ? 10 : 2} MB.`);
  if (action === "ringtone") {
    const result = await togetherFetch<AudioSettings>("/api/audio", { body: { action, name: file.name.slice(0, 180), data: encode(new Uint8Array(await file.arrayBuffer())) } });
    audioChanged(result); return result;
  }
  const { id } = await togetherFetch<{ id: string }>("/api/audio/upload", { body: { action: "start", name: file.name.slice(0, 180), size: file.size } });
  try {
    for (let offset = 0, index = 0; offset < file.size; offset += AUDIO_CHUNK_BYTES, index++) {
      const data = encode(new Uint8Array(await file.slice(offset, offset + AUDIO_CHUNK_BYTES).arrayBuffer()));
      await togetherFetch("/api/audio/upload", { body: { action: "part", id, index, data } });
      onProgress?.(Math.round(Math.min(file.size, offset + AUDIO_CHUNK_BYTES) / file.size * 100));
    }
    const result = await togetherFetch<AudioSettings>("/api/audio/upload", { body: { action: "finish", id } });
    audioChanged(result); return result;
  } finally { await togetherFetch("/api/audio/upload", { body: { action: "cancel", id } }).catch(() => {}); }
}
