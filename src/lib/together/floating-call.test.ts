import { expect, it } from "vitest";
import { clampFloatingCall } from "./floating-call";
const bounds = { left: 0, top: 0, width: 390, height: 844, inset: 12 };
it("keeps a dragged window inside all viewport edges", () => {
  expect(clampFloatingCall({ x: -100, y: -50 }, { width: 150, height: 200 }, bounds)).toEqual({ x: 12, y: 12 });
  expect(clampFloatingCall({ x: 900, y: 900 }, { width: 150, height: 200 }, bounds)).toEqual({ x: 228, y: 632 });
});
it("preserves free placement and handles keyboard/zoom viewport offsets", () => {
  expect(clampFloatingCall({ x: 80, y: 120 }, { width: 120, height: 160 }, bounds)).toEqual({ x: 80, y: 120 });
  expect(clampFloatingCall({ x: 300, y: 700 }, { width: 100, height: 130 }, { ...bounds, top: 60, height: 300 })).toEqual({ x: 278, y: 218 });
});
it("never produces negative coordinates in a very small viewport", () => {
  expect(clampFloatingCall({ x: 500, y: 500 }, { width: 160, height: 210 }, { ...bounds, width: 100, height: 100 })).toEqual({ x: 12, y: 12 });
});
