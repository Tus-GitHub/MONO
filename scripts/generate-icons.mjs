/** Generate every AMOR app icon from the same original vector paths as the UI. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(resolve(ROOT, "src/lib/brand/wordmark.ts"), "utf8");
const paths = Object.fromEntries([...source.matchAll(/export const (AMOR_\w+) = "([^"]+)"/g)].map((match) => [match[1], match[2]]));
if (Object.keys(paths).length !== 4) throw new Error("Missing AMOR artwork paths");
// Matches the existing ink, cream and clay design tokens.
const INK = "#211c17", CREAM = "#f5f1ea", CLAY = "#b45a41";
const artwork = (full, foreground = CREAM) => `${full ? `<path d="${paths.AMOR_LETTERS}" fill="${foreground}" fill-rule="evenodd"/>` : ""}<path d="${paths.AMOR_M}" fill="${foreground}"/><path d="${paths.AMOR_O}" fill="${foreground}" fill-rule="evenodd"/><path d="${paths.AMOR_STEM}" fill="${CLAY}"/><circle cx="145" cy="23" r="4" fill="${CLAY}"/>`;
function tile(size, maskable = false) {
  const width = maskable ? 0.55 : 0.72, scale = size * width / 158;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${INK}"/><g transform="translate(${size / 2 - 151 * scale} ${size / 2 - 65 * scale}) scale(${scale})">${artwork(false)}</g></svg>`;
}
await mkdir(resolve(ROOT, "public/brand"), { recursive: true });
await mkdir(resolve(ROOT, "public/icons"), { recursive: true });
for (const size of [192, 512]) for (const maskable of [false, true]) {
  const file = `public/icons/icon-${maskable ? "maskable-" : ""}${size}.png`;
  await sharp(Buffer.from(tile(size, maskable))).png().toFile(resolve(ROOT, file));
  console.log(file);
}
await sharp(Buffer.from(tile(180))).png().toFile(resolve(ROOT, "src/app/apple-icon.png"));
await writeFile(resolve(ROOT, "src/app/icon.svg"), tile(64));
// ICO with embedded PNG: supported by current browsers, no extra dependency.
const png = await sharp(Buffer.from(tile(64))).png().toBuffer();
const header = Buffer.alloc(22); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4); header[6] = 64; header[7] = 64; header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
await writeFile(resolve(ROOT, "src/app/favicon.ico"), Buffer.concat([header, png]));
for (const [name, color] of [["amor-wordmark", INK], ["amor-wordmark-light", CREAM]]) await writeFile(resolve(ROOT, `public/brand/${name}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="AMOR" viewBox="0 0 306 128">${artwork(true, color)}</svg>`);
console.log("AMOR wordmarks, favicon and app icons generated.");
