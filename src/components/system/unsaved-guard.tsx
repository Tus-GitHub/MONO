"use client";

import { useEffect, useRef } from "react";
import type { ActionState } from "@/lib/utils/result";
import { dirtyTransition, type DirtyState } from "@/lib/state/dirty";

/**
 * Drop inside a <form> to warn before an accidental reload / tab-close / browser-back throws
 * away typed-in changes. It watches the enclosing form for edits and arms `beforeunload`
 * until the form is successfully saved or reset. Client-side route changes in the App Router can't be
 * intercepted reliably, so this covers the unload cases the browser does expose.
 */
export function UnsavedGuard({ message, state, valueKey }: {
  message?: string;
  state?: ActionState;
  /** Serialized controlled values, including custom controls without native input events. */
  valueKey?: string;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const dirty = useRef<DirtyState>({ revision: 0, saved: 0, submitted: null });
  const previousValue = useRef(valueKey);

  useEffect(() => {
    if (previousValue.current !== valueKey) dirty.current = dirtyTransition(dirty.current, "edit");
    previousValue.current = valueKey;
  }, [valueKey]);

  useEffect(() => {
    if (state?.status === "success") dirty.current = dirtyTransition(dirty.current, "success");
    if (state?.status === "error") dirty.current = dirtyTransition(dirty.current, "failure");
  }, [state]);

  useEffect(() => {
    const form = anchorRef.current?.closest("form");
    if (!form) return;

    const markDirty = () => { dirty.current = dirtyTransition(dirty.current, "edit"); };
    const markClean = () => { dirty.current = dirtyTransition(dirty.current, "reset"); };
    const submit = () => { dirty.current = dirtyTransition(dirty.current, "submit"); };

    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);
    form.addEventListener("reset", markClean);
    form.addEventListener("submit", submit);
    return () => {
      form.removeEventListener("input", markDirty);
      form.removeEventListener("change", markDirty);
      form.removeEventListener("reset", markClean);
      form.removeEventListener("submit", submit);
    };
  }, []);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty.current.revision === dirty.current.saved) return;
      event.preventDefault();
      // Modern browsers show their own generic string; setting returnValue is what arms it.
      event.returnValue = message ?? "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [message]);

  return <span ref={anchorRef} hidden aria-hidden="true" />;
}
