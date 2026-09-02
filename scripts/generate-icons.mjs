/**
 * Generates the PWA / home-screen icon set from MONO's mark — no design tool, no extra
 * dependency (uses the `sharp` that already ships for the image pipeline).
 *
 *   node scripts/generate-icons.mjs   (or: npm run icons)
 *
 * Outputs:
 *   public/icons/icon-192.png             standard   (purpose: any)
 *   public/icons/icon-512.png             standard   (purpose: any)
 *   public/icons/icon-maskable-192.png    maskable   (safe-zone padding, full bleed)
 *   public/icons/icon-maskable-512.png    maskable
 *   src/app/apple-icon.png                180x180, opaque, square (iOS rounds it itself)
 *
 * The mark: a hairline cream ring + a filled clay disc, overlapping — "two as one". Drawn on
 * the brand ink ground so the tile reads on any wallpaper, light or dark.
 */
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Brand tokens (kept in sync with src/app/globals.css)
const INK = "#211c17"; // ground
const CREAM = "#f5f1ea"; // ring
const CLAY = "#b45a41"; // disc

/** The mark, centred in a `size` box. `markFraction` is the mark's width as a share of the box. */
function markSvg({ size, markFraction, radius }) {
  // Source mark lives in a 32-unit space: ring at (12.75,16) r7.75, disc at (19.25,16) r7.75.
  // Its bounding box is 22 wide × 15.5 tall, centred on x=16, y=16.
  const k = (size * markFraction) / 22;
  const cx = (dx) => (size / 2 + dx * k).toFixed(2);
  const r = (7.75 * k).toFixed(2);
  const sw = (2.25 * k).toFixed(2);
  const cornerRect = radius
    ? `<rect width="${size}" height="${size}" rx="${(size * radius).toFixed(2)}" fill="${INK}"/>`
    : `<rect width="${size}" height="${size}" fill="${INK}"/>`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      cornerRect +
      `<circle cx="${cx(-3.25)}" cy="${size / 2}" r="${r}" fill="none" stroke="${CREAM}" stroke-width="${sw}"/>` +
      `<circle cx="${cx(3.25)}" cy="${size / 2}" r="${r}" fill="${CLAY}"/>` +
      `</svg>`,
  );
}

const targets = [
  { file: "public/icons/icon-192.png", size: 192, markFraction: 0.62, radius: 0.18 },
  { file: "public/icons/icon-512.png", size: 512, markFraction: 0.62, radius: 0.18 },
  { file: "public/icons/icon-maskable-192.png", size: 192, markFraction: 0.44, radius: 0 },
  { file: "public/icons/icon-maskable-512.png", size: 512, markFraction: 0.44, radius: 0 },
  { file: "src/app/apple-icon.png", size: 180, markFraction: 0.6, radius: 0 },
];

await mkdir(resolve(ROOT, "public/icons"), { recursive: true });

for (const t of targets) {
  const out = resolve(ROOT, t.file);
  await sharp(markSvg(t), { density: 384 })
    .resize(t.size, t.size)
    .flatten({ background: INK })
    .png({ compressionLevel: 9 })
    .toFile(out);
  const meta = await sharp(out).metadata();
  console.log(`  ${t.file.padEnd(38)} ${meta.width}x${meta.height}  ${meta.hasAlpha ? "alpha" : "opaque"}`);
}

console.log("icons generated.");
