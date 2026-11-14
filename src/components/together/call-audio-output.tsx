"use client";
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { audioOutputs, routeCallAudio, type OutputDevice, type OutputMediaDevices } from "@/lib/together/audio-output";
import { Button } from "@/components/ui/button";
import { CallControl } from "./call-control";

const subscribe = () => () => {};
const routingSupported = () => typeof HTMLMediaElement.prototype.setSinkId === "function";
const pickerSupported = () => typeof (navigator.mediaDevices as OutputMediaDevices)?.selectAudioOutput === "function";

export function CallAudioOutput({ audio }: { audio: RefObject<HTMLAudioElement | null> }) {
  const [open, setOpen] = useState(false), [devices, setDevices] = useState<OutputDevice[]>([]);
  const [selected, setSelected] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const live = useRef(true);
  const canRoute = useSyncExternalStore(subscribe, routingSupported, () => false);
  const canChoose = useSyncExternalStore(subscribe, pickerSupported, () => false) && canRoute;
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => {
    if (!open) return;
    let current = true;
    const update = () => { if (typeof navigator.mediaDevices?.enumerateDevices === "function") void audioOutputs(navigator.mediaDevices).then((next) => { if (current) { setDevices(next); setSelected(audio.current?.sinkId ?? ""); } }).catch(() => { if (current) setMessage("Your browser could not list audio outputs. Use your phone’s audio controls."); }); };
    update(); navigator.mediaDevices?.addEventListener("devicechange", update);
    return () => { current = false; navigator.mediaDevices?.removeEventListener("devicechange", update); };
  }, [open, audio]);
  const choose = async (deviceId?: string) => {
    if (!audio.current || busy) return;
    setBusy(true); setMessage("");
    try {
      const media = navigator.mediaDevices as OutputMediaDevices;
      const id = deviceId ?? (await media.selectAudioOutput!()).deviceId;
      if (!live.current || !audio.current) return;
      await routeCallAudio(audio.current, id);
      if (live.current) { setSelected(id); setMessage("Output selected. If sound stays on the same speaker, use your phone’s audio controls."); }
      void audioOutputs(media).then((next) => { if (live.current) setDevices(next); }).catch(() => {});
    } catch (error) { if (live.current) setMessage(error instanceof Error && error.name === "NotAllowedError" ? "Audio output selection wasn’t allowed. Your call continues on its current output." : "Couldn’t switch output. Use your phone’s audio controls; your call is still connected."); }
    finally { if (live.current) setBusy(false); }
  };
  return <>
    <CallControl icon="speaker" label="Audio" active={open} onClick={() => setOpen(!open)} />
    {open ? <section aria-label="Call audio output" className="mono-call-popover space-y-3 rounded-xl border border-line bg-elevated p-4 text-ink shadow-xl">
      <div className="flex items-center justify-between gap-2"><h3 className="font-medium">Speaker & audio output</h3><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Close</Button></div>
      {canRoute ? <div className="flex flex-col gap-2">{devices.map((device) => <Button key={device.deviceId} size="sm" variant="secondary" disabled={busy} aria-pressed={selected === device.deviceId} onClick={() => void choose(device.deviceId)}>{device.label}</Button>)}{canChoose ? <Button size="sm" disabled={busy} onClick={() => void choose()}>Choose audio device</Button> : null}</div> : null}
      <p className="text-xs text-muted">{canRoute ? "Only outputs offered by your browser appear here. Your phone may manage its built-in speaker and earpiece itself." : "This browser doesn’t let MONO switch the speaker or earpiece. Use your phone’s audio controls, or connect headphones or Bluetooth."}</p>
      {message ? <p role="status" className="text-sm">{message}</p> : null}
    </section> : null}
  </>;
}
