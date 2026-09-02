"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Drop inside a <form> to warn before an accidental reload / tab-close / browser-back throws
 * away typed-in changes. It watches the enclosing form for edits and arms `beforeunload`
 * until the form is submitted or reset. Client-side route changes in the App Router can't be
 * intercepted reliably, so this covers the unload cases the browser does expose.
 */
export function UnsavedGuard({ message }: { message?: string }) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const form = anchorRef.current?.closest("form");
    if (!form) return;

    const markDirty = () => setDirty(true);
    const markClean = () => setDirty(false);

    form.addEventListener("input", markDirty);
    form.addEventListener("submit", markClean);
    form.addEventListener("reset", markClean);
    return () => {
      form.removeEventListener("input", markDirty);
      form.removeEventListener("submit", markClean);
      form.removeEventListener("reset", markClean);
    };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Modern browsers show their own generic string; setting returnValue is what arms it.
      event.returnValue = message ?? "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, message]);

  return <span ref={anchorRef} hidden aria-hidden="true" />;
}
