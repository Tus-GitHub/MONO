import { expect, it } from "vitest";
import sharp from "sharp";
import { cropRect } from "./crop";
import { cropToken, croppedSize, normalizedCrop, parseCropToken, readSavedCrop, savedCropPosition, sourceCrop } from "./saved-crop";
import { renderSavedCrop } from "./render-crop";
import { saveCropSchema } from "@/lib/validation/photo-crop";

it("reopens the same source region, without cumulative cropping", () => {
  for (const source of [{ width: 1200, height: 1800 }, { width: 2400, height: 800 }]) {
    for (const aspect of [1, 0.75, 2.5, source.width / source.height]) {
      const rect = cropRect(source, aspect, { x: 0.15, y: 0.8, zoom: 2.7 });
      const saved = normalizedCrop(rect, source)!;
      const restored = cropRect(source, aspect, savedCropPosition(source, saved));
      for (const field of ["x", "y", "width", "height"] as const) expect(restored[field]).toBeCloseTo(rect[field], 3);
    }
    expect(normalizedCrop(sourceCrop(null, source), source)).toBeNull();
  }
});
it("rejects invalid coordinates and target spoofing before a write", () => {
  for (const crop of [{ x: -1, y: 0, width: 1, height: 1 }, { x: 0.5, y: 0, width: 1, height: 1 }, { x: 0, y: 0, width: 0, height: 1 }, { x: NaN, y: 0, width: 1, height: 1 }]) expect(readSavedCrop(crop)).toBeNull();
  expect(saveCropSchema.safeParse({ target: { kind: "avatar", id: "someone-else" }, revision: "one", crop: null }).success).toBe(false);
  expect(saveCropSchema.safeParse({ target: { kind: "date" }, revision: "one", crop: null }).success).toBe(false);
});
it("round trips boundary crop URLs and derives visible dimensions", () => {
  const crop = { x: 0.00000001, y: 0, width: 0.5, height: 1 };
  expect(parseCropToken(cropToken(crop))).toEqual(crop);
  expect(croppedSize({ width: 1200, height: 1600 }, crop)).toEqual({ width: 600, height: 1600 });
  expect(croppedSize({}, crop)).toEqual({ width: null, height: null });
  expect(parseCropToken("0,0,5,1")).toBeNull();
});
it("renders the selected pixels in the upright source without changing the original", async () => {
  const red = await sharp({ create: { width: 40, height: 40, channels: 3, background: "red" } }).png().toBuffer();
  const original = await sharp({ create: { width: 80, height: 40, channels: 3, background: "blue" } }).composite([{ input: red, left: 0, top: 0 }]).png().toBuffer();
  const copy = Buffer.from(original);
  const cropped = await renderSavedCrop(original, { x: 0.5, y: 0, width: 0.5, height: 1 });
  expect(await sharp(cropped).metadata()).toMatchObject({ width: 40, height: 40 });
  const pixel = await sharp(cropped).resize(1, 1).raw().toBuffer();
  expect(pixel[2]).toBeGreaterThan(240); expect(pixel[0]).toBeLessThan(15); expect(original).toEqual(copy);
  const rotated = await sharp(original).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  expect(await sharp(await renderSavedCrop(rotated, { x: 0, y: 0, width: 1, height: 0.5 })).metadata()).toMatchObject({ width: 40, height: 40 });
});
