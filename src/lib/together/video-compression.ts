"use client";
import { attachmentName } from "./attachments";
import { VIDEO_MAX_BYTES } from "./video-policy";
export interface PreparedVideo { file: File; originalBytes: number; note: string }
export const videoSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
export function originalVideo(file: File, note = "Original quality · uploaded in small encrypted chunks"): PreparedVideo {
  if (!file.size) throw new Error("This video is empty. Choose another file.");
  if (file.size > VIDEO_MAX_BYTES) throw new Error("This video still exceeds the 512 MB transfer size after preparation. Trim it or try compression on another device; your file is unchanged.");
  if (!file.type.startsWith("video/") && !/\.(mp4|mov|webm|m4v)$/i.test(file.name)) throw new Error("Choose a video file.");
  const mime = file.type || (/\.webm$/i.test(file.name) ? "video/webm" : /\.mov$/i.test(file.name) ? "video/quicktime" : "video/mp4");
  return { file: file.type ? file : new File([file], file.name, { type: mime }), originalBytes: file.size, note };
}
/** Local WebCodecs conversion. Plaintext never goes to a compression service. */
export async function prepareVideo(file: File, signal: AbortSignal, progress: (value: number) => void): Promise<PreparedVideo> {
  if (file.size <= 8 * 1024 * 1024) return originalVideo(file);
  const m = await import("mediabunny");
  signal.throwIfAborted();
  const input = new m.Input({ source: new m.BlobSource(file), formats: m.ALL_FORMATS });
  let conversion: import("mediabunny").Conversion | undefined;
  const abort = () => { void conversion?.cancel(); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    const video = await input.getPrimaryVideoTrack(), audio = await input.getPrimaryAudioTrack();
    if (!video) throw new Error("No video track found.");
    const [width, height, duration] = await Promise.all([video.getDisplayWidth(), video.getDisplayHeight(), video.computeDuration()]);
    const mp4 = await m.canEncodeVideo("avc") && (!audio || await audio.getCodec() === "aac" || await m.canEncodeAudio("aac"));
    const target = new m.BufferTarget();
    const output = new m.Output({ format: mp4 ? new m.Mp4OutputFormat({ fastStart: "in-memory" }) : new m.WebMOutputFormat(), target });
    // Aim for ~24 MB, preserving readable motion and a maximum 720p long edge.
    const bitrate = Math.max(350_000, Math.min(1_600_000, 24 * 1024 * 1024 * 8 / Math.max(1, duration) - 96_000));
    const scale = Math.min(1, 720 / Math.max(width, height));
    conversion = await m.Conversion.init({ input, output,
      video: { codec: mp4 ? "avc" : "vp8", width: Math.max(2, Math.round(width * scale / 2) * 2), height: Math.max(2, Math.round(height * scale / 2) * 2), fit: "contain", frameRate: 30, quality: new m.Quality({ bitrate }), forceTranscode: true, allowTransformationMetadata: false },
      audio: { codec: mp4 ? "aac" : "opus" },
    });
    if (!conversion.isValid || conversion.discardedTracks.some(({ track }) => track.isAudioTrack() || track.isVideoTrack())) throw new Error("This browser cannot preserve the video and audio tracks.");
    signal.throwIfAborted();
    target.on("write", ({ end }) => { if (end > Math.min(VIDEO_MAX_BYTES, file.size)) void conversion?.cancel(); });
    conversion.onProgress = progress;
    await conversion.execute();
    signal.throwIfAborted();
    if (!target.buffer || target.buffer.byteLength >= file.size) return originalVideo(file, "Already compact · original quality kept");
    const compressed = new File([target.buffer], attachmentName(file.name.replace(/\.[^.]+$/, "") + (mp4 ? ".mp4" : ".webm")), { type: mp4 ? "video/mp4" : "video/webm" });
    return { file: compressed, originalBytes: file.size, note: `Compressed on this device · ${Math.round((1 - compressed.size / file.size) * 100)}% smaller` };
  } catch (error) {
    if (signal.aborted) throw error;
    return originalVideo(file, "This browser could not make a smaller copy safely. Original video kept, including its audio.");
  } finally { signal.removeEventListener("abort", abort); input.dispose(); }
}
