export type FloatingBounds = { left: number; top: number; width: number; height: number; inset: number };
export function clampFloatingCall(point: { x: number; y: number }, size: { width: number; height: number }, bounds: FloatingBounds) {
  const left = bounds.left + bounds.inset, top = bounds.top + bounds.inset;
  return { x: Math.max(left, Math.min(point.x, Math.max(left, bounds.left + bounds.width - size.width - bounds.inset))),
    y: Math.max(top, Math.min(point.y, Math.max(top, bounds.top + bounds.height - size.height - bounds.inset))) };
}
