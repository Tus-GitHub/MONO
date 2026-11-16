"use client";
import { useEffect, useRef, useState } from "react";
import { AUDIO_ACCEPT, MUSIC_LIMIT } from "@/lib/audio/file";
import { audioChanged, uploadAudio, type AudioSettings } from "@/lib/audio/client";
import type { MusicTrack } from "@/lib/audio/playlist";
import { musicOutput } from "@/lib/audio/music-output";
import { togetherFetch, errorMessage } from "@/lib/together/client";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";

export function AdminMusicLibrary() {
  const [settings, setSettings] = useState<AudioSettings | null>(null), [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [status, setStatus] = useState("");
  const [remove, setRemove] = useState<MusicTrack | null>(null), [previewId, setPreviewId] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null), audio = useRef<HTMLAudioElement>(null), output = useRef<ReturnType<typeof musicOutput> | null>(null);
  useEffect(() => { let live = true; void togetherFetch<AudioSettings>("/api/audio").then(value => { if (live) setSettings(value); }).catch(e => { if (live) setError(errorMessage(e)); }); return () => { live = false; }; }, []);
  useEffect(() => { if (!audio.current) return; const player = musicOutput(audio.current); output.current = player; player.setVolume(0.2); return () => { player.destroy(); output.current = null; }; }, []);
  const publish = async () => {
    if (busy || !files.length) return;
    setBusy(true); setError(""); let completed = 0;
    try {
      for (const file of files) {
        const next = await uploadAudio(file, "music", percent => setStatus(`Song ${completed + 1} of ${files.length} · ${percent}%`));
        setSettings(next); completed++; setFiles(files.slice(completed));
      }
      setStatus(`${completed} ${completed === 1 ? "song added" : "songs added"} to AMOR.`);
    } catch (e) { setError(errorMessage(e)); setStatus(`${completed} added. Remaining songs are ready to retry.`); }
    finally { setBusy(false); }
  };
  const removeSong = async () => {
    if (!remove || busy) return;
    setBusy(true); setError("");
    try {
      const next = await togetherFetch<AudioSettings>("/api/audio", { body: { action: "remove-music", id: remove.id } });
      if (previewId === remove.id) { output.current?.pause(); setPreviewId(null); }
      setSettings(next); audioChanged(next); setRemove(null); setStatus("Song removed from the library.");
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };
  const preview = (track: MusicTrack) => {
    if (!audio.current) return;
    if (previewId === track.id) { output.current?.pause(); setPreviewId(null); return; }
    audio.current.src = `/api/audio?kind=music&id=${encodeURIComponent(track.id)}&v=${encodeURIComponent(track.version)}`;
    void output.current?.play().then(() => setPreviewId(track.id)).catch(() => setError("This song could not play. Try its preview again."));
  };
  return <section className="my-6 space-y-4 rounded-2xl border border-line bg-surface p-5" aria-label="Website soundtrack">
    <div><h2 className="flex items-center gap-2 font-display text-xl"><Icon name="music" />AMOR song library</h2><p className="mt-2 text-sm text-muted">Add songs for everyone. Each person chooses their playlist, order, repeat mode and volume.</p></div>
    <audio ref={audio} preload="none" aria-label="Background song preview" onEnded={() => setPreviewId(null)} />
    <input ref={picker} className="sr-only" type="file" multiple accept={AUDIO_ACCEPT} aria-label="Choose background songs" disabled={busy} onChange={event => {
      const next = Array.from(event.target.files ?? []); event.target.value = ""; setError(""); setStatus("");
      if (next.some(file => !file.size || file.size > MUSIC_LIMIT)) { setError("Each song must be an audio file up to 10 MB."); return; }
      setFiles(next);
    }} />
    <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={busy} onClick={() => picker.current?.click()}><Icon name="upload" size="sm" />Choose songs</Button>{files.length ? <Button loading={busy} onClick={() => void publish()}>Publish {files.length === 1 ? "song" : `${files.length} songs`}</Button> : null}</div>
    {files.length ? <ul className="space-y-1 text-sm text-muted" aria-label="Songs ready to upload">{files.map((file, index) => <li key={`${file.name}:${index}`} className="truncate">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</li>)}</ul> : null}
    <p className="text-xs text-muted">MP3, M4A, WAV or Ogg · up to 10 MB per song. New uploads add to the library. Upload audio you have permission to share.</p>
    {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}{status ? <p role="status" className="text-sm text-muted">{status}</p> : null}
    <ul className="space-y-2" aria-label="Published background songs">{settings?.tracks.map(track => <li key={track.id} data-track-id={track.id} className="flex items-center gap-3 rounded-xl border border-line bg-elevated p-3">
      <Button size="icon" variant="secondary" aria-label={`${previewId === track.id ? "Pause" : "Preview"} ${track.title}`} onClick={() => preview(track)}><Icon name={previewId === track.id ? "pause" : "play"} /></Button>
      <p className="min-w-0 flex-1 truncate text-sm">{track.title}</p><Button size="icon" variant="ghost" aria-label={`Remove ${track.title}`} disabled={busy} onClick={() => setRemove(track)}><Icon name="trash" size="sm" /></Button>
    </li>)}</ul>
    {settings && !settings.tracks.length ? <p className="text-sm text-muted">Your library is ready for its first song.</p> : null}
    <Modal open={!!remove} onClose={() => { if (!busy) setRemove(null); }} title="Remove this song?" description={remove?.title} footer={<><Button variant="secondary" disabled={busy} onClick={() => setRemove(null)}>Keep song</Button><Button variant="danger" loading={busy} onClick={() => void removeSong()}>Remove song</Button></>}><p>It will leave the library and everyone’s playlists. Other songs stay available.</p></Modal>
  </section>;
}
