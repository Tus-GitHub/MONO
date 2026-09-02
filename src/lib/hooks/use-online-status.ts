"use client";

import { useEffect, useState } from "react";

/**
 * Tracks browser connectivity. SSR-safe: assumes online until the client tells us otherwise,
 * so nothing flashes an offline state during hydration.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return online;
}
