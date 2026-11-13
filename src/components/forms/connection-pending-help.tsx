"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

/** A fresh status navigation is safe even if the original submission committed after a disconnect. */
export function ConnectionPendingHelp() {
  const { pending } = useFormStatus();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setSlow(true), 8_000);
    return () => { clearTimeout(timer); setSlow(false); };
  }, [pending]);
  if (!pending || !slow) return null;
  return <p role="status" className="text-sm text-muted">
    This is taking longer than usual. Your invitation stays safe.{" "}
    <a href="/onboarding" className="underline">Check your connection status</a> without submitting again.
  </p>;
}
