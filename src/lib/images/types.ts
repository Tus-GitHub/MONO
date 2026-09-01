/**
 * Image processing abstraction. Business code depends on `ImageProcessor`, never on a concrete
 * library, so the sharp-backed implementation can be swapped (or disabled) without touching
 * the upload pipeline. Types here are pure and client-safe.
 */

export type ImageVariant = "original" | "display" | "thumb";

export interface RenderedImage {
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
  bytes: number;
}

export interface ProcessedImage {
  /** Dimensions of the orientation-corrected source — for aspect-ratio boxes (no layout shift). */
  width: number;
  height: number;
  /** Re-encoded, EXIF-stripped full image, capped so an "original" is never enormous. */
  original: RenderedImage;
  /** ~1400px long edge — the gallery / lightbox default. */
  display: RenderedImage;
  /** ~480px long edge — grids, cards, thumbnails. */
  thumb: RenderedImage;
  /** Tiny inline `data:` URI for the blur-up placeholder (empty string if unavailable). */
  blurDataUrl: string;
  /** File extension shared by every produced variant, e.g. "webp". */
  ext: string;
}

export interface ImageProcessor {
  readonly name: string;
  /** `mime` is the source's declared type; a re-encoding processor may ignore it. */
  process(input: Buffer, mime?: string): Promise<ProcessedImage>;
}
