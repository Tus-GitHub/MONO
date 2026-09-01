import type { ImageProcessor, ProcessedImage, RenderedImage } from "@/lib/images/types";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/**
 * Pass-through processor: stores the original bytes for every variant, no resizing, no blur.
 * For test runs and any environment where libvips isn't available. `IMAGE_PROCESSOR=noop`.
 */
export class NoopImageProcessor implements ImageProcessor {
  readonly name = "noop";

  async process(input: Buffer, mime?: string): Promise<ProcessedImage> {
    const rendered: RenderedImage = {
      buffer: input,
      contentType: mime ?? "application/octet-stream",
      width: 0,
      height: 0,
      bytes: input.byteLength,
    };
    return {
      width: 0,
      height: 0,
      original: rendered,
      display: rendered,
      thumb: rendered,
      blurDataUrl: "",
      ext: (mime && EXT[mime]) || "bin",
    };
  }
}
