/** Shared framing math. Coordinates are in the upright source image, not screen pixels. */
export const COUPLE_PHOTO_ASPECT = 5 / 2;
export const MAX_CROP_ZOOM = 4;
export interface ImageSize { width: number; height: number }
export interface CropPosition { x: number; y: number; zoom: number }
export interface CropRect extends ImageSize { x: number; y: number }
export const INITIAL_CROP: CropPosition = { x: 0.5, y: 0.5, zoom: 1 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function cropRect(image: ImageSize, aspect: number, position: CropPosition): CropRect {
  if (![image.width, image.height, aspect].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("That image has invalid dimensions.");
  }
  const zoom = clamp(position.zoom, 1, MAX_CROP_ZOOM);
  const width = Math.min(image.width, image.height * aspect) / zoom;
  const height = width / aspect;
  return {
    width, height,
    x: Math.max(0, image.width - width) * clamp(position.x, 0, 1),
    y: Math.max(0, image.height - height) * clamp(position.y, 0, 1),
  };
}

/** Drag deltas are fractions of the visible frame, so touch and mouse behave identically. */
export function panCrop(image: ImageSize, aspect: number, position: CropPosition, dx: number, dy: number): CropPosition {
  const rect = cropRect(image, aspect, position);
  const horizontal = image.width - rect.width;
  const vertical = image.height - rect.height;
  return {
    ...position,
    x: horizontal > 0 ? clamp(position.x - dx * rect.width / horizontal, 0, 1) : 0.5,
    y: vertical > 0 ? clamp(position.y - dy * rect.height / vertical, 0, 1) : 0.5,
  };
}

/** Keep the selected subject in place when the zoom changes, including near image edges. */
export function zoomCrop(image: ImageSize, aspect: number, position: CropPosition, zoom: number): CropPosition {
  const before = cropRect(image, aspect, position);
  const next = { ...position, zoom: clamp(zoom, 1, MAX_CROP_ZOOM) };
  const after = cropRect(image, aspect, next);
  return {
    ...next,
    x: image.width > after.width ? clamp((before.x + (before.width - after.width) / 2) / (image.width - after.width), 0, 1) : 0.5,
    y: image.height > after.height ? clamp((before.y + (before.height - after.height) / 2) / (image.height - after.height), 0, 1) : 0.5,
  };
}
