"use client";
import { useCallback, useEffect, useState, useSyncExternalStore, type RefObject } from "react";
import { enterCallPip, leaveCallPip, supportsCallPip, type PipVideo } from "@/lib/together/picture-in-picture";

export function useCallPictureInPicture(ref: RefObject<HTMLVideoElement | null>, active: boolean) {
  const [error, setError] = useState("");
  const subscribe = useCallback((change: () => void) => {
    if (!active) return () => {};
    const video = ref.current;
    const events = ["loadedmetadata", "resize", "emptied", "enterpictureinpicture", "leavepictureinpicture", "webkitpresentationmodechanged"];
    for (const name of events) video?.addEventListener(name, change);
    return () => { for (const name of events) video?.removeEventListener(name, change); };
  }, [ref, active]);
  const supported = useSyncExternalStore(subscribe, () => active && supportsCallPip(ref.current), () => false);
  const outside = useSyncExternalStore(subscribe, () => active && !!ref.current && (document.pictureInPictureElement === ref.current || (ref.current as PipVideo).webkitPresentationMode === "picture-in-picture"), () => false);
  const open = useCallback(async (automatic = false) => {
    const video = ref.current; if (!video) return;
    try { await enterCallPip(video); setError(""); }
    catch (reason) { if (!automatic) setError(reason instanceof Error && reason.name === "NotAllowedError" ? "Your browser did not allow pop-out video. Keep using the mini view in MONO." : "Pop-out video is unavailable in this browser. The mini view and your call still work inside MONO."); }
  }, [ref]);
  useEffect(() => {
    const video = ref.current;
    if (!active || !video) return;
    const action = "enterpictureinpicture" as MediaSessionAction;
    // Supported Chromium browsers invoke this when an active call goes into the background.
    try { navigator.mediaSession?.setActionHandler(action, () => { void open(true); }); } catch { /* Optional platform capability. */ }
    return () => {
      try { navigator.mediaSession?.setActionHandler(action, null); } catch { /* Not supported. */ }
      void leaveCallPip(video).catch(() => {});
    };
  }, [active, ref, open]);
  return { supported, outside, error, toggle: () => { if (outside && ref.current) void leaveCallPip(ref.current).catch(() => {}); else void open(); } };
}
