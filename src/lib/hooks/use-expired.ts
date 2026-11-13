"use client";

import { useEffect, useState } from "react";

/** Derive expiry from the deadline; never keep an independent expired flag across identities. */
export function useExpired(deadline: number | null): boolean {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null || now >= deadline) return;
    const update = () => setNow(Date.now());
    const timer = window.setTimeout(update, Math.min(Math.max(0, deadline - Date.now()), 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [deadline, now]);
  return deadline !== null && now >= deadline;
}
