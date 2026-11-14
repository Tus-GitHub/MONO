"use client";
import { useEffect, useRef, useState } from "react";
import { bindRemoteAudio } from "@/lib/together/remote-audio";
import { createCallAudioRouter, type CallAudioRouter } from "@/lib/together/audio-router";

/** Remains mounted when the call dialog is minimized. */
export function useRemoteCallAudio(stream: MediaStream | null) {
  const element = useRef<HTMLAudioElement | null>(null);
  const router = useRef<CallAudioRouter | null>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    if (element.current && stream) {
      const unbind = bindRemoteAudio(element.current, stream, setBlocked);
      const output = createCallAudioRouter(element.current, setBlocked); router.current = output;
      return () => { output.dispose(); router.current = null; unbind(); };
    }
  }, [stream]);
  return { element, router, blocked: Boolean(stream && blocked), resume: () => void router.current?.resume().catch(() => {}) };
}
