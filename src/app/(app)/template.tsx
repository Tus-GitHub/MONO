import type { ReactNode } from "react";

/**
 * Re-mounts on every navigation within the app, so each page does a quiet rise-in.
 * `anim-rise` is neutralised by the global reduced-motion rule.
 */
export default function AppTemplate({ children }: { children: ReactNode }) {
  return <div className="anim-rise">{children}</div>;
}
