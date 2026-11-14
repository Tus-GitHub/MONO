"use client";

import { useEffect, type RefObject } from "react";

/** Bring the first invalid field into view when a forward step is refused. */
export function useValidationFocus(ref: RefObject<HTMLFormElement | null>, active: boolean, step = "") {
  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => {
      const field = ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      if (!field) return;
      field.scrollIntoView({ block: "center", behavior: "smooth" });
      if (field.matches("input,select,textarea")) field.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [ref, active, step]);
}
