"use client";
import { useEffect, useRef, useState } from "react";
import { CALL_TONE_URL, ringtonePlayer } from "@/lib/together/ringtone";
import { AUDIO_CHANGED, type AudioSettings } from "@/lib/audio/client";
import { togetherFetch } from "@/lib/together/client";

export function useCallRingtone(id: string | undefined, ringing: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const player = useRef<ReturnType<typeof ringtonePlayer> | null>(null);
  const [blocked, setBlocked] = useState(false), [ready, setReady] = useState(false);
  const [customTone, setCustomTone] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const apply = (value: AudioSettings) => { if (live) setCustomTone(value.ringtoneVersion ? `/api/audio?kind=ringtone&v=${encodeURIComponent(value.ringtoneVersion)}` : null); };
    void togetherFetch<AudioSettings>("/api/audio").then(apply).catch(() => {});
    const receive = (event: Event) => apply((event as CustomEvent<AudioSettings>).detail);
    window.addEventListener(AUDIO_CHANGED, receive);
    return () => { live = false; window.removeEventListener(AUDIO_CHANGED, receive); };
  }, []);
  useEffect(() => { if (audioRef.current && !ringing) audioRef.current.src = customTone ?? CALL_TONE_URL; }, [customTone, ringing]);
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
