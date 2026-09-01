import "server-only";

import sharp from "sharp";

import type { ImageProcessor, ProcessedImage, RenderedImage } from "@/lib/images/types";

/**
 * sharp-backed processor. For every upload it produces three WebP variants plus a tiny blur
 * placeholder, applies EXIF orientation, and — by *not* copying input metadata onto the
 * output — strips GPS and other EXIF tags on the way through (a privacy win).
 */

const ORIGINAL_MAX = 2560; // an "original" the app will actually serve — not the raw camera file
const DISPLAY_MAX = 1400;
const THUMB_MAX = 480;
const BLUR_MAX = 24;

async function encodeWebp(
  input: Buffer,
  maxEdge: number,
  quality: number,
): Promise<RenderedImage> {
  const { data, info } = await sharp(input, { failOn: "none" })
    .rotate() // bake in EXIF orientation, then drop metadata
    .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
    .webp({ quality })
    .toBuffer({ resolveWithObject: true });
  return {
    buffer: data,
    contentType: "image/webp",
    width: info.width,
    height: info.height,
    bytes: data.length,
  };
}

export class SharpImageProcessor implements ImageProcessor {
  readonly name = "sharp";

  async process(input: Buffer): Promise<ProcessedImage> {
    const [original, display, thumb, blur] = await Promise.all([
      encodeWebp(input, ORIGINAL_MAX, 82),
      encodeWebp(input, DISPLAY_MAX, 78),
      encodeWebp(input, THUMB_MAX, 68),
      sharp(input, { failOn: "none" })
        .rotate()
        .resize({ width: BLUR_MAX, height: BLUR_MAX, fit: "inside" })
        .webp({ quality: 40 })
        .toBuffer(),
    ]);

    return {
      width: original.width,
      height: original.height,
      original,
      display,
      thumb,
      blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
      ext: "webp",
    };
  }
}
