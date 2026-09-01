/**
 * MONO motion language. Small and shared — premium interaction, not visual noise.
 * Mirrors the `--dur-*` / `--ease-*` custom properties in globals.css.
 *
 * Where to use motion: navigation, page transitions, card entrance, selection, rating,
 * photo selection, modal/sheet transitions, date completion, milestones.
 * Where NOT to: everything else. Motion is the exception, not the default.
 */

export const DURATION = {
  /** micro-feedback: toggles, hovers */
  fast: 110,
  /** default: most enter/exit transitions */
  base: 190,
  /** deliberate: sheets, page transitions, larger surfaces */
  slow: 300,
  /** celebratory: completion, milestones */
  slower: 460,
} as const;

export const EASING = {
  /** decelerate — the default for things entering */
  out: "cubic-bezier(0.22, 1, 0.36, 1)",
  /** symmetric — for things that move and settle in place */
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  /** gentle overshoot — selection, rating, pop */
  spring: "cubic-bezier(0.34, 1.4, 0.64, 1)",
} as const;

/** True when the user asked the OS to reduce motion. Safe to call on the server (returns false). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A CSS transition shorthand from the shared vocabulary. */
export function transition(
  properties: string | string[],
  duration: keyof typeof DURATION = "base",
  easing: keyof typeof EASING = "out",
): string {
  const list = Array.isArray(properties) ? properties : [properties];
  return list.map((p) => `${p} ${DURATION[duration]}ms ${EASING[easing]}`).join(", ");
}
