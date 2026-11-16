"use client";
import { useEffect, useRef, useState } from "react";
import { AUDIO_ACCEPT, AUDIO_LIMIT } from "@/lib/audio/file";
import { audioChanged, uploadAudio, type AudioSettings } from "@/lib/audio/client";
import { togetherFetch, errorMessage } from "@/lib/together/client";
import { CALL_TONE_URL } from "@/lib/together/ringtone";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { MusicControls } from "./background-music";
import { AdminMusicLibrary } from "./admin-music-library";

export function AudioSettingsCard({ admin = false }: { admin?: boolean }) {
  return admin ? <AdminMusicLibrary /> : <PersonalAudioSettings />;
}
function PersonalAudioSettings() {
  const [settings, setSettings] = useState<AudioSettings | null>(null), [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState("");
  const limit = AUDIO_LIMIT, limitLabel = "2 MB";
  const picker = useRef<HTMLInputElement | null>(null);
  useEffect(() => { let live = true; void togetherFetch<AudioSettings>("/api/audio").then((value) => { if (live) setSettings(value); }).catch((e) => { if (live) setError(errorMessage(e)); }); return () => { live = false; }; }, []);
  const save = async (remove = false) => {
    if (busy || (!file && !remove)) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const next = remove ? await togetherFetch<AudioSettings>("/api/audio", { body: { action: "remove-ringtone" } }) : await uploadAudio(file!, "ringtone");
      setSettings(next); audioChanged(next); setFile(null); setSuccess(remove ? "Sound removed." : "Your ringtone is saved.");
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return <section className="my-6 space-y-4 rounded-2xl border border-line bg-surface p-5" aria-label="Your sounds">
    <h2 className="flex items-center gap-2 font-display text-xl"><Icon name="music" />Your ringtone</h2>
    <p className="text-sm text-muted">Choose what plays on this account when making or receiving a call.</p>
    <p className="break-all text-sm">{settings?.ringtoneName ?? "Anywhere With You · default"}</p>
    {settings ? <audio controls preload="none" className="w-full" aria-label="Ringtone preview" src={settings.ringtoneVersion ? `/api/audio?kind=ringtone&v=${encodeURIComponent(settings.ringtoneVersion)}` : CALL_TONE_URL} /> : null}
    <input ref={picker} className="sr-only" type="file" accept={AUDIO_ACCEPT} aria-label="Choose ringtone" disabled={busy} onChange={(event) => { const next = event.target.files?.[0]; event.target.value = ""; if (!next) return; setSuccess(""); if (!next.size || next.size > limit) { setError(`Choose an audio file up to ${limitLabel}.`); return; } setError(""); setFile(next); }} />
    <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={busy} onClick={() => picker.current?.click()}><Icon name="upload" size="sm" />Choose audio</Button>{file ? <Button loading={busy} onClick={() => void save()}>Save ringtone</Button> : null}{settings?.ringtoneName ? <Button variant="ghost" disabled={busy} onClick={() => void save(true)}>Use default ringtone</Button> : null}</div>
    {file ? <p className="break-all text-sm">Ready: {file.name}</p> : null}<p className="text-xs text-muted">MP3, M4A, WAV or Ogg · up to {limitLabel}. MP3 works across the most devices. Your browser may require a tap before it can play sound.</p>
    {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}{success ? <p role="status" className="text-sm text-success">{success}</p> : null}
    {<div className="space-y-4 border-t border-line pt-4"><h3 className="font-medium">Background music</h3><MusicControls /></div>}
  </section>;
}
