/** Visual-viewport geometry in layout CSS pixels; pinch zoom is not a keyboard. */
export function viewportGeometry({
  layoutHeight, visualHeight, visualTop, scale, baselineHeight,
  editing, keyboardWasOpen, touch,
}: {
  layoutHeight: number; visualHeight: number; visualTop: number; scale: number;
  baselineHeight: number; editing: boolean; keyboardWasOpen: boolean; touch: boolean;
}) {
  const layout = Math.max(1, Number.isFinite(layoutHeight) ? layoutHeight : 1);
  if (!Number.isFinite(visualHeight) || visualHeight <= 0 || Math.abs(scale - 1) > 0.01) {
    return { top: 0, height: layout, bottom: 0, keyboardOpen: false };
  }
  const height = Math.min(layout, visualHeight);
  const keyboardOpen = (editing || keyboardWasOpen) && (
    layout - height > 120 || (touch && baselineHeight - height > 120)
  );
  const offset = Math.max(0, Number.isFinite(visualTop) ? visualTop : 0);
  // iOS can pan past the layout's bottom edge to reveal the caret. Clamping that
  // offset hides the header above the visible viewport, especially in standalone mode.
  const top = keyboardOpen ? offset : Math.min(offset, layout - height);
  const bottom = Math.max(0, layout - height - top);
  return { top, height, bottom, keyboardOpen };
}

/** Positive scroll moves a covered field upward; negative scroll reveals one above the view. */
export function focusScrollDelta(top: number, bottom: number, visibleTop: number, visibleBottom: number, checkBelow: boolean) {
  if (top < visibleTop) return top - visibleTop;
  if (checkBelow && bottom > visibleBottom) return bottom - visibleBottom;
  return 0;
}
