"use client";
import { useEffect, useRef, useState } from "react";
import { ringtonePlayer } from "@/lib/together/ringtone";

export function useCallRingtone(id: string | undefined, ringing: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const player = useRef<ReturnType<typeof ringtonePlayer> | null>(null);
  const [blocked, setBlocked] = useState(false), [ready, setReady] = useState(false);
  useEffect(() => {
    if (!audioRef.current) return;
    const tone = ringtonePlayer(audioRef.current, (value) => { setBlocked(value); setReady(!value); });
    player.current = tone;
    return () => { tone.destroy(); if (player.current === tone) player.current = null; };
  }, []);
  useEffect(() => {
    if (!id || !ringing) return;
    void player.current?.play();
    return () => player.current?.stop();
  }, [id, ringing]);
  useEffect(() => {
    if (!ringing || !blocked) return;
    const retry = (event: Event) => { if (event.isTrusted) void player.current?.play(); };
    document.addEventListener("pointerdown", retry);
    document.addEventListener("keydown", retry);
    return () => { document.removeEventListener("pointerdown", retry); document.removeEventListener("keydown", retry); };
  }, [ringing, blocked]);
  return { audioRef, blocked: ringing && blocked, ready,
    play: () => void player.current?.play(), enable: () => void player.current?.play(!ringing), stop: () => player.current?.stop() };
}
