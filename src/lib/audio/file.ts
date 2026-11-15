export const AUDIO_LIMIT = 2 * 1024 * 1024;
export const AUDIO_ACCEPT = ".mp3,.mpeg,.wav,.ogg,.m4a";
/** Inspect the container rather than trusting a browser-supplied MIME type. */
export function audioType(bytes: Uint8Array): string | null {
  const head = (start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length));
  if (bytes.length < 16) return null;
  if (head(0, 3) === "ID3" || (bytes[0] === 255 && (bytes[1] & 224) === 224)) return "audio/mpeg";
  if (head(0, 4) === "RIFF" && head(8, 4) === "WAVE") return "audio/wav";
  if (head(0, 4) === "OggS") return "audio/ogg";
  if (head(4, 4) === "ftyp" && ["M4A ", "M4B ", "isom", "mp42"].includes(head(8, 4))) return "audio/mp4";
  return null;
}
export function audioRange(header: string | null, length: number): { start: number; end: number } | null | false {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return false;
  const start = match[1] ? Number(match[1]) : Math.max(0, length - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(length - 1, Number(match[2])) : length - 1;
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start <= end && start < length ? { start, end } : false;
}
