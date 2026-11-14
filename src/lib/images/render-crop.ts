import "server-only";
import sharp from "sharp";
import { ValidationError } from "@/lib/errors";
import type { SavedCrop } from "./saved-crop";

export async function renderSavedCrop(bytes: Buffer, crop: SavedCrop): Promise<Buffer> {
  try {
    const image = sharp(bytes, { limitInputPixels: 40_000_000 });
    const metadata = await image.metadata();
    const rotate = (metadata.orientation ?? 1) >= 5;
    const width = rotate ? metadata.height : metadata.width, height = rotate ? metadata.width : metadata.height;
    if (!width || !height) throw new Error("Missing dimensions");
    const left = Math.min(width - 1, Math.round(crop.x * width)), top = Math.min(height - 1, Math.round(crop.y * height));
    return await image.rotate().extract({ left, top, width: Math.max(1, Math.min(width - left, Math.round(crop.width * width))),
      height: Math.max(1, Math.min(height - top, Math.round(crop.height * height))) }).webp({ quality: 90 }).toBuffer();
  } catch { throw new ValidationError("This saved photo could not be adjusted."); }
}
