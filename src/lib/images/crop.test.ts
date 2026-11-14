import { describe, expect, it } from "vitest";
import { COUPLE_PHOTO_ASPECT, INITIAL_CROP, cropRect, panCrop, zoomCrop } from "./crop";

describe("photo framing", () => {
  it("keeps the complete photo at Original and starts a couple banner centered", () => {
    const image = { width: 1200, height: 1800 };
    expect(cropRect(image, 2 / 3, INITIAL_CROP)).toEqual({ x: 0, y: 0, width: 1200, height: 1800 });
    expect(cropRect(image, COUPLE_PHOTO_ASPECT, INITIAL_CROP)).toEqual({ x: 0, y: 660, width: 1200, height: 480 });
  });

  it("allows reaching the top and bottom without exposing empty pixels", () => {
    const image = { width: 1200, height: 1800 };
    const top = cropRect(image, COUPLE_PHOTO_ASPECT, panCrop(image, COUPLE_PHOTO_ASPECT, INITIAL_CROP, 100, 100));
    const bottom = cropRect(image, COUPLE_PHOTO_ASPECT, panCrop(image, COUPLE_PHOTO_ASPECT, INITIAL_CROP, -100, -100));
    expect(top.y).toBe(0);
    expect(bottom.y + bottom.height).toBe(image.height);
    expect(top.x).toBe(0);
    expect(bottom.x).toBe(0);
  });

  it("keeps the subject's center fixed when zooming in", () => {
    const image = { width: 2400, height: 1600 };
    const position = { x: 0.3, y: 0.7, zoom: 1.5 };
    const before = cropRect(image, 1, position);
    const after = cropRect(image, 1, zoomCrop(image, 1, position, 3));
    expect(after.x + after.width / 2).toBeCloseTo(before.x + before.width / 2);
    expect(after.y + after.height / 2).toBeCloseTo(before.y + before.height / 2);
  });

  it("clamps zoom-out and extreme drags for wide, portrait and tiny images", () => {
    for (const image of [{ width: 6000, height: 1200 }, { width: 720, height: 4000 }, { width: 1, height: 1 }]) {
      for (const aspect of [COUPLE_PHOTO_ASPECT, 1, 3 / 4, image.width / image.height]) {
        for (const dx of [-50, 0, 50]) {
          const moved = panCrop(image, aspect, { x: 0.2, y: 0.8, zoom: 4 }, dx, -dx);
          for (const zoom of [-10, 1, 2, 100]) {
            const position = zoomCrop(image, aspect, moved, zoom);
            const crop = cropRect(image, aspect, position);
            expect(position.zoom).toBeGreaterThanOrEqual(1);
            expect(position.zoom).toBeLessThanOrEqual(4);
            expect(crop.width / crop.height).toBeCloseTo(aspect);
            expect(crop.x).toBeGreaterThanOrEqual(0);
            expect(crop.y).toBeGreaterThanOrEqual(0);
            expect(crop.x + crop.width).toBeLessThanOrEqual(image.width + 1e-8);
            expect(crop.y + crop.height).toBeLessThanOrEqual(image.height + 1e-8);
          }
        }
      }
    }
  });

  it("rejects invalid source dimensions", () => {
    expect(() => cropRect({ width: 0, height: 1 }, 1, INITIAL_CROP)).toThrow("invalid dimensions");
  });
});
