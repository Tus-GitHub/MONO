/**
 * JS mirror of the design tokens defined in `src/app/globals.css`.
 *
 * CSS is the source of truth for anything that renders; import from here only when logic
 * needs a token value (media queries in JS, motion timings, measured layout).
 */

/** Breakpoints in px. Keep in sync with `@theme` in globals.css. */
export const BREAKPOINTS = {
  xs: 360, // small phones
  sm: 640, // large phones
  md: 768, // tablets
  lg: 1024, // laptops
  xl: 1280, // desktops
  "2xl": 1536, // large desktops
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

export const mediaUp = (bp: Breakpoint) => `(min-width: ${BREAKPOINTS[bp]}px)`;
export const mediaDown = (bp: Breakpoint) => `(max-width: ${BREAKPOINTS[bp] - 0.02}px)`;

/** Layout constants (also CSS vars: --topbar-h, --bottomnav-h, --sidebar-w). */
export const LAYOUT = {
  topBarHeight: 56,
  bottomNavHeight: 64,
  sidebarWidth: 248,
  contentMax: 1088,
  proseMax: 672,
} as const;

/** Icon sizes in px. The `<Icon>` component's `size` keyword maps to these. */
export const ICON_SIZE = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
} as const;

export type IconSize = keyof typeof ICON_SIZE;

/** Control heights in px (Tailwind: h-9 / h-11 / h-13). Shared by Button, Input, Select. */
export const CONTROL_HEIGHT = {
  sm: 36,
  md: 44,
  lg: 52,
} as const;
