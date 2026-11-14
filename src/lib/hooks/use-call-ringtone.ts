"use client";
import { useEffect, useRef, useState } from "react";
import { CALL_TONE_URL, ringtonePlayer } from "@/lib/together/ringtone";

export function useCallRingtone(id: string | undefined, ringing: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const player = useRef<ReturnType<typeof ringtonePlayer> | null>(null);
  const [blockedFor, setBlockedFor] = useState<string | null>(null);
  useEffect(() => {
    const audio = audioRef.current;
    if (!id || !ringing || !audio) return;
    audio.src = CALL_TONE_URL;
    const tone = ringtonePlayer(audio, (blocked) => setBlockedFor(blocked ? id : null));
    player.current = tone;
    void tone.play();
    return () => { tone.stop(); if (player.current === tone) player.current = null; };
  }, [id, ringing]);
  return { audioRef, blocked: ringing && blockedFor === id, play: () => void player.current?.play() };
}
