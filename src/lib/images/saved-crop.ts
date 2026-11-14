import { cropRect, INITIAL_CROP, MAX_CROP_ZOOM, type CropPosition, type CropRect, type ImageSize } from "./crop";

/** Fractions of the stored, upright source. Source bytes never change when this changes. */
export interface SavedCrop { x: number; y: number; width: number; height: number }
export type CropTarget = "avatar" | "couple" | "date" | "chat";
export interface SavedCropInfo { sourceUrl: string; crop: SavedCrop | null; revision: string }

export function readSavedCrop(value: unknown): SavedCrop | null {
  if (!value || typeof value !== "object") return null;
  const { x, y, width, height } = value as SavedCrop;
  if (![x, y, width, height].every((n) => typeof n === "number" && Number.isFinite(n))
    || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1.000001 || y + height > 1.000001) return null;
  return { x, y, width, height };
}
export function normalizedCrop(rect: CropRect, source: ImageSize): SavedCrop | null {
  const round = (n: number) => Math.round(n * 1e8) / 1e8;
  const result = { x: round(rect.x / source.width), y: round(rect.y / source.height), width: round(rect.width / source.width), height: round(rect.height / source.height) };
  return result.x === 0 && result.y === 0 && result.width === 1 && result.height === 1 ? null : result;
}
export function sourceCrop(crop: SavedCrop | null, source: ImageSize): CropRect {
  return crop ? { x: crop.x * source.width, y: crop.y * source.height, width: crop.width * source.width, height: crop.height * source.height }
    : { x: 0, y: 0, ...source };
}
export function savedCropPosition(source: ImageSize, crop: SavedCrop | null): CropPosition {
  if (!crop) return INITIAL_CROP;
  const rect = sourceCrop(crop, source), base = cropRect(source, rect.width / rect.height, INITIAL_CROP);
  return { zoom: Math.max(1, Math.min(MAX_CROP_ZOOM, base.width / rect.width)),
    x: source.width > rect.width ? rect.x / (source.width - rect.width) : 0.5,
    y: source.height > rect.height ? rect.y / (source.height - rect.height) : 0.5 };
}
export function cropToken(crop: SavedCrop | null): string {
  return crop ? [crop.x, crop.y, crop.width, crop.height].map((n) => n.toFixed(8).replace(/\.?0+$/, "")).join(",") : "";
}
export function parseCropToken(token: string): SavedCrop | null {
  if (token.length > 120 || !/^\d+(?:\.\d+)?(?:,\d+(?:\.\d+)?){3}$/.test(token)) return null;
  const [x, y, width, height] = token.split(",").map(Number);
  return readSavedCrop({ x, y, width, height });
}
export function croppedUrl(url: string, crop: SavedCrop | null): string {
  return crop ? `${url}${url.includes("?") ? "&" : "?"}crop=${cropToken(crop)}` : url;
}
export function croppedSize(source: { width?: number | null; height?: number | null }, crop: SavedCrop | null) {
  return { width: source.width ? Math.max(1, Math.round(source.width * (crop?.width ?? 1))) : null,
    height: source.height ? Math.max(1, Math.round(source.height * (crop?.height ?? 1))) : null };
}
