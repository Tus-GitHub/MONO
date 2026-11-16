"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AUDIO_CHANGED, audioChanged, type AudioSettings } from "@/lib/audio/client";
import { musicPlaylist, nextMusicId, orderedTracks, type MusicPreferences, type MusicTrack } from "@/lib/audio/playlist";
import { togetherFetch, errorMessage } from "@/lib/together/client";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { musicOutput } from "@/lib/audio/music-output";

type MusicContextValue = { settings: AudioSettings | null; current: MusicTrack | null; blocked: boolean; error: string; saving: boolean; pausedForCall: boolean;
  change: (value: Partial<MusicPreferences>) => void; resume: () => void; playTrack: (id: string) => void; skip: (direction: 1 | -1) => void };
const MusicContext = createContext<MusicContextValue | null>(null);
const preferences = (settings: AudioSettings): MusicPreferences => ({ musicEnabled: settings.musicEnabled, musicVolume: settings.musicVolume,
  musicMode: settings.musicMode, musicOrder: settings.musicOrder, musicSelectedIds: settings.musicSelectedIds, musicRepeatOne: settings.musicRepeatOne });
export function BackgroundMusic({ pausedForCall, children }: { pausedForCall: boolean; children: ReactNode }) {
  const [settings, setSettings] = useState<AudioSettings | null>(null), [blocked, setBlocked] = useState(false), [error, setError] = useState("");
  const [currentId, setCurrentId] = useState<string | null>(null), [saving, setSaving] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null), pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queue = useRef<Promise<unknown>>(Promise.resolve()), latest = useRef<AudioSettings | null>(null), dirty = useRef(false), revision = useRef(0);
  const output = useRef<ReturnType<typeof musicOutput> | null>(null);
  const playlist = settings ? musicPlaylist(settings.tracks, settings) : [];
  const current = playlist.find(track => track.id === currentId) ?? playlist[0] ?? null;
  useEffect(() => { if (!audio.current) return; const player = musicOutput(audio.current); output.current = player; return () => { player.destroy(); output.current = null; }; }, []);
  useEffect(() => {
    let live = true;
    const receiveSettings = (value: AudioSettings) => { if (!live) return; const next = dirty.current && latest.current ? { ...value, ...preferences(latest.current) } : value; latest.current = next; setSettings(next); };
    const refresh = () => { void togetherFetch<AudioSettings>("/api/audio").then(receiveSettings).catch(() => {}); };
    const receive = (event: Event) => { const value = (event as CustomEvent<AudioSettings>).detail; const next = dirty.current && latest.current ? { ...value, ...preferences(latest.current) } : value; latest.current = next; setSettings(next); };
    refresh(); window.addEventListener(AUDIO_CHANGED, receive);
    const visible = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { live = false; window.removeEventListener(AUDIO_CHANGED, receive); document.removeEventListener("visibilitychange", visible); clearTimeout(pending.current); };
  }, []);
  const trackKey = current ? `${current.id}:${current.version}` : "";
  useEffect(() => {
    const player = audio.current; if (!player || player.dataset.trackKey === trackKey) return;
    player.pause(); player.dataset.trackKey = trackKey;
    if (current) player.src = `/api/audio?kind=music&id=${encodeURIComponent(current.id)}&v=${encodeURIComponent(current.version)}`;
    else { player.removeAttribute("src"); player.load(); }
  }, [trackKey, current]);
  useEffect(() => {
    output.current?.setVolume(settings?.musicVolume ?? 0.2);
    if (!settings?.musicEnabled || !trackKey || pausedForCall) { output.current?.pause(); return; }
    void output.current?.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
  }, [settings?.musicEnabled, settings?.musicVolume, trackKey, pausedForCall]);
  const resume = () => { if (!pausedForCall && current) void output.current?.play().then(() => setBlocked(false)).catch(() => setBlocked(true)); };
  const change = (value: Partial<MusicPreferences>) => {
    if (!latest.current) return;
    const next = { ...latest.current, ...value }, version = ++revision.current;
    latest.current = next; dirty.current = true; audioChanged(next); setError(""); setSaving(true);
    output.current?.setVolume(next.musicVolume);
    if (next.musicEnabled && current && !pausedForCall) resume(); else output.current?.pause();
    clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      queue.current = queue.current.catch(() => {}).then(() => togetherFetch<AudioSettings>("/api/audio", { body: { action: "preferences", ...preferences(next) } }))
        .then(() => { if (revision.current === version) { dirty.current = false; setSaving(false); } })
        .catch(e => { if (revision.current === version) { setSaving(false); setError(`Sound preference was not saved: ${errorMessage(e)}`); } });
    }, 250);
  };
  const playTrack = (id: string) => {
    const track = settings?.tracks.find(track => track.id === id); if (!track) return;
    setCurrentId(id); setError("");
    if (audio.current) { audio.current.dataset.trackKey = `${track.id}:${track.version}`; audio.current.src = `/api/audio?kind=music&id=${encodeURIComponent(id)}&v=${encodeURIComponent(track.version)}`; }
    const selected = settings!.musicMode === "selected" && !settings!.musicSelectedIds.includes(id) ? [...settings!.musicSelectedIds, id] : settings!.musicSelectedIds;
    change({ musicEnabled: true, musicSelectedIds: selected });
    if (!pausedForCall) void output.current?.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
  };
  const skip = (direction: 1 | -1) => { const id = nextMusicId(playlist, current?.id ?? null, direction); if (id) playTrack(id); };
  return <MusicContext.Provider value={{ settings, current, blocked, error, saving, pausedForCall, change, resume, playTrack, skip }}>
    <audio ref={audio} loop={!!settings?.musicRepeatOne || playlist.length === 1} preload="none" aria-label="Background music" onEnded={() => setCurrentId(nextMusicId(playlist, current?.id ?? null))}
      onError={() => setError("This song could not play. Try the next song or reload.")} />{children}</MusicContext.Provider>;
}
export function MusicControls() {
  const music = useContext(MusicContext);
  if (!music?.settings) return <p className="text-sm text-muted">Music controls will appear when sound settings load.</p>;
  const { settings, change, current } = music, tracks = orderedTracks(settings.tracks, settings.musicOrder), playlist = musicPlaylist(tracks, settings);
  const included = (id: string) => settings.musicMode === "all" || settings.musicSelectedIds.includes(id);
  const toggle = (id: string) => { const ids = playlist.map(track => track.id); change({ musicMode: "selected", musicSelectedIds: included(id) ? ids.filter(value => value !== id) : [...ids, id] }); };
  const move = (index: number, direction: -1 | 1) => { const ids = tracks.map(track => track.id); [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]]; change({ musicOrder: ids }); };
  return <div className="space-y-4">
    <div className="rounded-xl bg-primary-tint p-4"><p className="text-xs text-muted">Your soundtrack</p><p className="mt-1 truncate font-display text-lg text-ink">{current?.title ?? (tracks.length ? "Choose songs for your playlist" : "No background songs have been shared yet.")}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2"><Button variant="ghost" size="icon" aria-label="Previous song" disabled={!playlist.length} onClick={() => music.skip(-1)}><Icon name="chevronLeft" /></Button>
        <Button variant="secondary" disabled={!playlist.length} aria-pressed={settings.musicEnabled} onClick={() => change({ musicEnabled: !settings.musicEnabled })}><Icon name={settings.musicEnabled ? "pause" : "play"} size="sm" />{settings.musicEnabled ? "Pause music" : "Play music"}</Button>
        <Button variant="ghost" size="icon" aria-label="Next song" disabled={!playlist.length} onClick={() => music.skip(1)}><Icon name="chevronRight" /></Button>
        <Button variant="ghost" size="icon" aria-label={settings.musicVolume ? "Mute music" : "Unmute music"} onClick={() => change({ musicVolume: settings.musicVolume ? 0 : 0.2 })}><Icon name="speaker" /></Button></div>
    </div>
    <label className="block space-y-2 text-sm">Music volume · {Math.round(settings.musicVolume * 100)}%<input className="block w-full accent-primary" type="range" min="0" max="100" aria-label="Background music volume" value={Math.round(settings.musicVolume * 100)} onChange={event => change({ musicVolume: Number(event.target.value) / 100 })} /></label>
    <p className="text-xs text-muted">A soft volume scale: 2% is almost silent, 20% is a quiet background hum. Music pauses during calls.</p>
    {tracks.length ? <><div className="flex flex-wrap gap-2"><Button size="sm" variant={settings.musicMode === "all" ? "primary" : "secondary"} aria-pressed={settings.musicMode === "all"} onClick={() => change({ musicMode: "all" })}>Play all songs</Button>
      <Button size="sm" variant={settings.musicRepeatOne ? "primary" : "secondary"} aria-pressed={settings.musicRepeatOne} onClick={() => change({ musicRepeatOne: !settings.musicRepeatOne })}><Icon name="refresh" size="sm" />{settings.musicRepeatOne ? "Repeat this song" : "Repeat playlist"}</Button></div>
      <p className="text-xs text-muted">Select the songs you want. Use the arrows to change your order.</p>
      <ol className="space-y-2" aria-label="Your music playlist">{tracks.map((track, index) => <li key={track.id} data-track-id={track.id} className="flex items-center gap-1 rounded-xl border border-line bg-surface p-2">
        <Button size="icon" variant={included(track.id) ? "primary" : "ghost"} aria-pressed={included(track.id)} aria-label={`${included(track.id) ? "Exclude" : "Include"} ${track.title}`} onClick={() => toggle(track.id)}><Icon name={included(track.id) ? "check" : "plus"} size="sm" /></Button>
        <button className="min-w-0 flex-1 rounded-lg px-2 py-2 text-left text-sm text-ink hover:bg-primary-tint" aria-label={`Play ${track.title}`} onClick={() => music.playTrack(track.id)}><span className="block truncate">{track.title}</span>{current?.id === track.id ? <span className="text-xs text-primary">{settings.musicEnabled ? "Now playing" : "Selected"}</span> : null}</button>
        <div className="flex shrink-0"><Button size="icon" variant="ghost" disabled={index === 0} aria-label={`Move ${track.title} up`} onClick={() => move(index, -1)}><Icon name="chevronUp" size="sm" /></Button><Button size="icon" variant="ghost" disabled={index === tracks.length - 1} aria-label={`Move ${track.title} down`} onClick={() => move(index, 1)}><Icon name="chevronDown" size="sm" /></Button></div>
      </li>)}</ol></> : null}
    {music.pausedForCall ? <p className="text-xs text-muted">Paused while a call is active.</p> : music.blocked && settings.musicEnabled ? <Button variant="secondary" onClick={music.resume}>Tap to hear music</Button> : null}
    <p role="status" className="text-xs text-muted">{music.saving ? "Saving your soundtrack…" : music.error ? "Changes are kept on this screen. Try again to save." : "Your music choices are saved to your account."}</p>
    {music.error ? <p role="alert" className="text-sm text-error">{music.error}<Button size="sm" variant="ghost" onClick={() => change(preferences(settings))}>Retry save</Button></p> : null}
  </div>;
}
export function MusicButton() {
  const [open, setOpen] = useState(false), music = useContext(MusicContext);
  if (!music?.settings?.tracks.length) return null;
  return <><Button variant="ghost" size="icon" aria-label="Music controls" onClick={() => setOpen(true)}><Icon name="music" /></Button><BottomSheet open={open} title="Your soundtrack" onClose={() => setOpen(false)}><MusicControls /></BottomSheet></>;
}
