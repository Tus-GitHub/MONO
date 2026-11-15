import { togetherFetch } from "@/lib/together/client";
export interface AudioSettings { ringtoneName: string | null; ringtoneVersion: string | null; musicVolume: number; musicEnabled: boolean; music: { title: string; version: string } | null }
export const AUDIO_CHANGED = "mono:audio-settings";
export function audioChanged(settings: AudioSettings) { window.dispatchEvent(new CustomEvent(AUDIO_CHANGED, { detail: settings })); }
export async function uploadAudio(file: File, action: "ringtone" | "music"): Promise<AudioSettings> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = ""; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const result = await togetherFetch<AudioSettings>("/api/audio", { body: { action, name: file.name.slice(0, 180), data: btoa(binary) } });
  audioChanged(result); return result;
}
