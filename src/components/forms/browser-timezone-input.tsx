"use client";

import { useEffect, useRef } from "react";

/** Capture the creating browser's zone without changing the onboarding interface. */
export function BrowserTimezoneInput() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, []);
  return <input ref={ref} type="hidden" name="timezone" defaultValue="UTC" />;
}
