import type { ReactNode, SVGProps } from "react";

import { ICON_SIZE, type IconSize } from "@/lib/design/tokens";
import { cn } from "@/lib/utils/cn";

/**
 * MONO's own line-icon set — one consistent stroke, no third-party icon dependency, no
 * generic-SaaS glyph pack. Add glyphs to `GLYPHS` as needed.
 */
const GLYPHS = {
  home: (
    <>
      <path d="M3 10.75 12 4l9 6.75" />
      <path d="M5.5 9.5V20h13V9.5" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  calendarPlus: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5" />
    </>
  ),
  calendarCheck: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4M9 15l2 2 4-4" />
    </>
  ),
  images: (
    <>
      <rect x="3" y="3" width="14" height="14" rx="2.5" />
      <path d="M21 7.5V18a3 3 0 0 1-3 3H7.5" />
      <circle cx="8.5" cy="8" r="1.4" />
      <path d="m3.5 13.5 3-3a2 2 0 0 1 2.8 0l4.7 4.5" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.6 8.4-2 5.2-5.2 2 2-5.2z" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 19.5a5.75 5.75 0 0 1 11 0" />
      <path d="M15.5 5.1a3.25 3.25 0 0 1 0 5.8" />
      <path d="M17.8 19.5a5.75 5.75 0 0 0-2.4-4.7" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.75" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="M5 12.5l4.2 4.2L19 7" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronUp: <path d="m6 15 6-6 6 6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  arrowRight: (
    <>
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="M20 12H5" />
      <path d="m11 6-6 6 6 6" />
    </>
  ),
  star: (
    <path d="M12 3.6l2.6 5.28 5.82.85-4.21 4.1.99 5.8L12 17.9l-5.2 2.73.99-5.8-4.21-4.1 5.82-.85z" />
  ),
  heart: (
    <path d="M12 19.5S4 14.5 4 9.2A4.2 4.2 0 0 1 8.2 5c1.9 0 3.1 1 3.8 2.1C12.7 6 13.9 5 15.8 5A4.2 4.2 0 0 1 20 9.2c0 5.3-8 10.3-8 10.3Z" />
  ),
  camera: (
    <>
      <path d="M4 8.75A2.5 2.5 0 0 1 6.5 6.25H8L9.3 4h5.4L16 6.25h1.5A2.5 2.5 0 0 1 20 8.75v8A2.5 2.5 0 0 1 17.5 19.25h-11A2.5 2.5 0 0 1 4 16.75z" />
      <circle cx="12" cy="12.5" r="3.4" />
    </>
  ),
  mapPin: (
    <>
      <path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17a1 1 0 0 1 1 1v2" />
      <path d="M4 7.5v9A2.5 2.5 0 0 0 6.5 19h12A1.5 1.5 0 0 0 20 17.5v-8A1.5 1.5 0 0 0 18.5 8H6.5" />
      <path d="M15.5 12.75h.01" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 4l1.5 4.2L18 10l-4.5 1.8L12 16l-1.5-4.2L6 10l4.5-1.8z" />
      <path d="M18.5 15l.7 1.9 1.8.6-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.6z" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  alertTriangle: (
    <>
      <path d="M12 4 2.8 20h18.4z" />
      <path d="M12 10v4.5M12 17.5h.01" />
    </>
  ),
  alertCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </>
  ),
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.4 2.4 4.6-5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.4l3.6 2.1" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20h4L18.4 9.6a2.1 2.1 0 0 0-3-3L5 17z" />
      <path d="m13.5 6.6 3 3" />
    </>
  ),
  trash: <path d="M4 7h16M9 7V5h6v2M6.5 7l1 13h9l1-13" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3.25" />
      <path d="M12 2.5v3M12 18.5v3M4.5 6.5l2.1 2.1M17.4 17.4l2.1 2.1M2.5 12h3M18.5 12h3M4.5 17.5l2.1-2.1M17.4 6.6l2.1-2.1" />
    </>
  ),
  logout: (
    <>
      <path d="M15 12H4" />
      <path d="m8 8-4 4 4 4" />
      <path d="M12 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  moreHorizontal: (
    <>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </>
  ),
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2.5" />
      <path d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-6A3.5 3.5 0 0 0 3 6.5v6A2.5 2.5 0 0 0 5.5 15" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M9.9 5.7A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.7 3.4" />
      <path d="M6.3 7.4A16.7 16.7 0 0 0 2.5 12S6 18.5 12 18.5c1.7 0 3.2-.5 4.5-1.2" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M4 4l16 16" />
    </>
  ),
  share: (
    <>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" />
    </>
  ),
  link: (
    <>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M8 12.5 6.5 14a3.5 3.5 0 0 0 5 5l1.5-1.5" />
      <path d="M16 11.5 17.5 10a3.5 3.5 0 0 0-5-5L11 6.5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11.5A8 8 0 1 0 18 17" />
      <path d="M20 5v6h-6" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  bell: (
    <>
      <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  heartHandshake: (
    <>
      <path d="M12 8.5C11 7 9.5 6 8 6a3.5 3.5 0 0 0-2.5 6l6.5 6.5L18.5 12A3.5 3.5 0 0 0 16 6c-1.5 0-3 1-4 2.5Z" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof GLYPHS;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: IconSize | number;
  /** When set, the icon is announced; otherwise it is decorative. */
  title?: string;
}

export function Icon({ name, size = "md", title, className, strokeWidth = 1.6, ...props }: IconProps) {
  const px = typeof size === "number" ? size : ICON_SIZE[size];
  return (
    <svg
      viewBox="0 0 24 24"
      width={px}
      height={px}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn("shrink-0", className)}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {GLYPHS[name]}
    </svg>
  );
}
