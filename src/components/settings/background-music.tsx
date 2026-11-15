"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AUDIO_CHANGED, audioChanged, type AudioSettings } from "@/lib/audio/client";
import { togetherFetch, errorMessage } from "@/lib/together/client";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { musicOutput } from "@/lib/audio/music-output";

const MusicContext = createContext<{ settings: AudioSettings | null; blocked: boolean; error: string; pausedForCall: boolean; change: (enabled: boolean, volume: number) => void; resume: () => void } | null>(null);
export function BackgroundMusic({ pausedForCall, children }: { pausedForCall: boolean; children: ReactNode }) {
  const [settings, setSettings] = useState<AudioSettings | null>(null), [blocked, setBlocked] = useState(false), [error, setError] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null), pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const output = useRef<ReturnType<typeof musicOutput> | null>(null);
  useEffect(() => { if (!audio.current) return; const player = musicOutput(audio.current); output.current = player; return () => { player.destroy(); output.current = null; }; }, []);
  useEffect(() => {
    let live = true;
    const refresh = () => { void togetherFetch<AudioSettings>("/api/audio").then((value) => { if (live) setSettings(value); }).catch(() => {}); };
    const receive = (event: Event) => setSettings((event as CustomEvent<AudioSettings>).detail);
    refresh(); window.addEventListener(AUDIO_CHANGED, receive);
    const visible = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { live = false; window.removeEventListener(AUDIO_CHANGED, receive); document.removeEventListener("visibilitychange", visible); clearTimeout(pending.current); };
  }, []);
  const version = settings?.music?.version;
  useEffect(() => {
    const player = audio.current; if (!player) return;
    player.pause();
    if (version) player.src = `/api/audio?kind=music&v=${encodeURIComponent(version)}`;
    else { player.removeAttribute("src"); player.load(); }
  }, [version]);
  useEffect(() => {
    const player = audio.current; if (!player) return;
    output.current?.setVolume(settings?.musicVolume ?? 0.2);
    if (!settings?.musicEnabled || !version || pausedForCall) { output.current?.pause(); return; }
    void output.current?.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
  }, [settings?.musicEnabled, settings?.musicVolume, version, pausedForCall]);
  const resume = () => { if (!pausedForCall) void output.current?.play().then(() => setBlocked(false)).catch(() => setBlocked(true)); };
  const change = (musicEnabled: boolean, musicVolume: number) => {
    if (!settings) return;
    const next = { ...settings, musicEnabled, musicVolume };
    audioChanged(next); setError("");
    // Start in the tap handler, preserving mobile browser user activation.
    if (audio.current) { output.current?.setVolume(musicVolume); if (musicEnabled && version && !pausedForCall) resume(); else output.current?.pause(); }
    clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      queue.current = queue.current.catch(() => {}).then(() => togetherFetch("/api/audio", { body: { action: "preferences", musicEnabled, musicVolume } })).catch((e) => setError(`Sound preference was not saved: ${errorMessage(e)}`));
    }, 250);
  };
  return <MusicContext.Provider value={{ settings, blocked, error, pausedForCall, change, resume }}><audio ref={audio} loop preload="none" aria-label="Background music" onError={() => setError("This track could not play. Try another format or reload.")} />{children}</MusicContext.Provider>;
}
export function MusicControls() {
  const music = useContext(MusicContext);
  if (!music?.settings) return <p className="text-sm text-muted">Music controls will appear when sound settings load.</p>;
  const { settings, change } = music;
  return <div className="space-y-4"><p className="text-sm text-muted">{settings.music?.title ?? "No background song has been shared yet."}</p>
    <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={!settings.music} aria-pressed={settings.musicEnabled} onClick={() => change(!settings.musicEnabled, settings.musicVolume)}><Icon name={settings.musicEnabled ? "pause" : "play"} size="sm" />{settings.musicEnabled ? "Pause music" : "Play music"}</Button>
      <Button variant="ghost" disabled={!settings.music} onClick={() => change(settings.musicEnabled, settings.musicVolume ? 0 : 0.2)}><Icon name="speaker" size="sm" />{settings.musicVolume ? "Mute music" : "Unmute music"}</Button></div>
    <label className="block space-y-2 text-sm">Music volume · {Math.round(settings.musicVolume * 100)}%<input className="block w-full accent-primary" type="range" min="0" max="100" aria-label="Background music volume" value={Math.round(settings.musicVolume * 100)} onChange={(event) => change(settings.musicEnabled, Number(event.target.value) / 100)} /></label>
    <p className="text-xs text-muted">Starts at 20%. Your preference is saved. Music pauses during calls.</p>
    {music.pausedForCall ? <p className="text-xs text-muted">Paused while a call is active.</p> : music.blocked && settings.musicEnabled ? <Button variant="secondary" onClick={music.resume}>Tap to hear music</Button> : null}
    {music.error ? <p role="alert" className="text-sm text-error">{music.error}</p> : null}
  </div>;
}
export function MusicButton() {
  const [open, setOpen] = useState(false), music = useContext(MusicContext);
  if (!music?.settings?.music) return null;
  return <><Button variant="ghost" size="icon" aria-label="Music controls" onClick={() => setOpen(true)}><Icon name="music" /></Button><BottomSheet open={open} title="Your soundtrack" onClose={() => setOpen(false)}><MusicControls /></BottomSheet></>;
}
