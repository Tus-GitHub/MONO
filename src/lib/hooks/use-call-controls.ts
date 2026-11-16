"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createCallControls } from "@/lib/together/call-controls";

const initiallyVisible = () => true;

export function useCallControls(open: boolean, autoHide: boolean, callId: string | null) {
  const [controls] = useState(createCallControls);
  const visible = useSyncExternalStore(controls.subscribe, controls.getSnapshot, initiallyVisible);
  useEffect(() => {
    const sync = () => controls.configure(open && autoHide && !document.hidden);
    const keydown = (event: KeyboardEvent) => {
      // Let the toggle activate once; revealing it here before its click would hide it again.
      if ((event.key === "Enter" || event.key === " ") && event.target instanceof Element && event.target.closest(".mono-call-stage-toggle")) return;
      if (open && (event.key === "Tab" || event.key === "Enter" || event.key === " " || event.key.startsWith("Arrow"))) controls.useKeyboard();
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("keydown", keydown, true);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("keydown", keydown, true);
      controls.stop();
    };
  }, [controls, open, autoHide, callId]);
  return { visible: !autoHide || visible, interact: controls.interact, toggle: controls.toggle };
}
