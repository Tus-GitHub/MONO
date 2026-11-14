import { expect, it } from "vitest";
import { focusScrollDelta, viewportGeometry } from "./viewport";

const base = { layoutHeight: 844, visualHeight: 844, visualTop: 0, scale: 1,
  baselineHeight: 844, editing: false, keyboardWasOpen: false, touch: true };

it("fits a shifted Safari keyboard viewport even when little bottom occlusion remains", () => {
  expect(viewportGeometry({ ...base, editing: true, visualHeight: 400, visualTop: 400 }))
    .toEqual({ top: 400, height: 400, bottom: 44, keyboardOpen: true });
});
it("detects a touch keyboard when the browser resizes the layout too", () => {
  expect(viewportGeometry({ ...base, editing: true, layoutHeight: 500, visualHeight: 500 }).keyboardOpen).toBe(true);
});
it("keeps keyboard state through blur while the viewport is still occluded", () => {
  expect(viewportGeometry({ ...base, keyboardWasOpen: true, visualHeight: 400 }).keyboardOpen).toBe(true);
  expect(viewportGeometry({ ...base, keyboardWasOpen: true }).keyboardOpen).toBe(false);
});
it("does not turn pinch zoom into a keyboard or shrink fixed overlays", () => {
  expect(viewportGeometry({ ...base, editing: true, visualHeight: 422, visualTop: 80, scale: 2 }))
    .toEqual({ top: 0, height: 844, bottom: 0, keyboardOpen: false });
});
it("does not classify browser chrome or desktop resizing as a keyboard", () => {
  expect(viewportGeometry({ ...base, visualHeight: 700 }).keyboardOpen).toBe(false);
  expect(viewportGeometry({ ...base, editing: true, touch: false, layoutHeight: 500, visualHeight: 500 }).keyboardOpen).toBe(false);
});
it("uses the new orientation baseline instead of the previous portrait height", () => {
  expect(viewportGeometry({ ...base, editing: true, layoutHeight: 390, visualHeight: 390, baselineHeight: 390 }).keyboardOpen).toBe(false);
  expect(viewportGeometry({ ...base, editing: true, layoutHeight: 190, visualHeight: 190, baselineHeight: 390 }).keyboardOpen).toBe(true);
});
it("bounds transient overscroll and invalid viewport measurements", () => {
  expect(viewportGeometry({ ...base, visualHeight: 500, visualTop: 900 })).toMatchObject({ top: 344, bottom: 0 });
  expect(viewportGeometry({ ...base, visualHeight: 0 })).toMatchObject({ height: 844, keyboardOpen: false });
});
it("corrects focus against offset visual edges rather than just viewport height", () => {
  expect(focusScrollDelta(600, 644, 88, 422, true)).toBe(222);
  expect(focusScrollDelta(40, 84, 88, 422, true)).toBe(-48);
  expect(focusScrollDelta(200, 244, 88, 422, true)).toBe(0);
  expect(focusScrollDelta(600, 644, 88, 422, false)).toBe(0);
});
