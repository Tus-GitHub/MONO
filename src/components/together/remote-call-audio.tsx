"use client";
import { useEffect, useRef, useState } from "react";
import { bindRemoteAudio } from "@/lib/together/remote-audio";

/** Remains mounted when the call dialog is minimized. */
export function useRemoteCallAudio(stream: MediaStream | null) {
  const element = useRef<HTMLAudioElement | null>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    if (element.current && stream) return bindRemoteAudio(element.current, stream, setBlocked);
  }, [stream]);
  return { element, blocked: Boolean(stream && blocked), resume: () => void element.current?.play().then(() => setBlocked(false)).catch(() => setBlocked(true)) };
}
