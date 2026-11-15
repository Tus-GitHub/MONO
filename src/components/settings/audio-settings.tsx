"use client";
import { useEffect, useRef, useState } from "react";
import { AUDIO_ACCEPT, AUDIO_LIMIT } from "@/lib/audio/file";
import { audioChanged, uploadAudio, type AudioSettings } from "@/lib/audio/client";
import { togetherFetch, errorMessage } from "@/lib/together/client";
import { CALL_TONE_URL } from "@/lib/together/ringtone";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { MusicControls } from "./background-music";

export function AudioSettingsCard({ admin = false }: { admin?: boolean }) {
  const [settings, setSettings] = useState<AudioSettings | null>(null), [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState("");
  const picker = useRef<HTMLInputElement | null>(null);
  useEffect(() => { let live = true; void togetherFetch<AudioSettings>("/api/audio").then((value) => { if (live) setSettings(value); }).catch((e) => { if (live) setError(errorMessage(e)); }); return () => { live = false; }; }, []);
  const save = async (remove = false) => {
    if (busy || (!file && !remove)) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const next = remove ? await togetherFetch<AudioSettings>("/api/audio", { body: { action: admin ? "remove-music" : "remove-ringtone" } }) : await uploadAudio(file!, admin ? "music" : "ringtone");
      setSettings(next); audioChanged(next); setFile(null); setSuccess(remove ? "Sound removed." : admin ? "Background song updated for MONO users." : "Your ringtone is saved.");
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return <section className="my-6 space-y-4 rounded-2xl border border-line bg-surface p-5" aria-label={admin ? "Website soundtrack" : "Your sounds"}>
    <h2 className="flex items-center gap-2 font-display text-xl"><Icon name="music" />{admin ? "Website soundtrack" : "Your ringtone"}</h2>
    <p className="text-sm text-muted">{admin ? "Share one background song across MONO. Each user controls playback and volume; their starting volume is 20%." : "Choose what plays on this account when making or receiving a call."}</p>
    <p className="break-all text-sm">{admin ? settings?.music?.title ?? "No background song" : settings?.ringtoneName ?? "Anywhere With You · default"}</p>
    {settings && (!admin || settings.music) ? <audio controls preload="none" className="w-full" aria-label={admin ? "Background song preview" : "Ringtone preview"} src={admin ? `/api/audio?kind=music&v=${encodeURIComponent(settings.music!.version)}` : settings.ringtoneVersion ? `/api/audio?kind=ringtone&v=${encodeURIComponent(settings.ringtoneVersion)}` : CALL_TONE_URL} /> : null}
    <input ref={picker} className="sr-only" type="file" accept={AUDIO_ACCEPT} aria-label={admin ? "Choose background song" : "Choose ringtone"} disabled={busy} onChange={(event) => { const next = event.target.files?.[0]; event.target.value = ""; if (!next) return; setSuccess(""); if (!next.size || next.size > AUDIO_LIMIT) { setError("Choose an audio file up to 2 MB."); return; } setError(""); setFile(next); }} />
    <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={busy} onClick={() => picker.current?.click()}><Icon name="upload" size="sm" />Choose audio</Button>{file ? <Button loading={busy} onClick={() => void save()}>{admin ? "Publish song to MONO" : "Save ringtone"}</Button> : null}{(admin ? settings?.music : settings?.ringtoneName) ? <Button variant="ghost" disabled={busy} onClick={() => void save(true)}>{admin ? "Remove song" : "Use default ringtone"}</Button> : null}</div>
    {file ? <p className="break-all text-sm">Ready: {file.name}</p> : null}<p className="text-xs text-muted">MP3, M4A, WAV or Ogg · up to 2 MB. MP3 works across the most devices. {admin ? "Upload audio you have permission to share." : "Your browser may require a tap before it can play sound."}</p>
    {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}{success ? <p role="status" className="text-sm text-success">{success}</p> : null}
    {!admin ? <div className="space-y-4 border-t border-line pt-4"><h3 className="font-medium">Background music</h3><MusicControls /></div> : null}
  </section>;
}
