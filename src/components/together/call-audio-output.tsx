"use client";
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { audioOutputs, type OutputDevice, type OutputMediaDevices } from "@/lib/together/audio-output";
import { elementRoutingSupported, contextRoutingSupported, compatibilityRoutingSupported, type CallAudioRouter } from "@/lib/together/audio-router";
import { Button } from "@/components/ui/button";
import { CallControl } from "./call-control";

const subscribe = () => () => {};
const routingSupported = () => elementRoutingSupported() || contextRoutingSupported();
const pickerSupported = () => typeof (navigator.mediaDevices as OutputMediaDevices)?.selectAudioOutput === "function";

export function CallAudioOutput({ audio, router }: { audio: RefObject<HTMLAudioElement | null>; router: RefObject<CallAudioRouter | null> }) {
  const [open, setOpen] = useState(false), [devices, setDevices] = useState<OutputDevice[]>([]);
  const [selected, setSelected] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const live = useRef(true);
  const [compatibility, setCompatibility] = useState(false), [revision, setRevision] = useState(0);
  const canRoute = useSyncExternalStore(subscribe, routingSupported, () => false);
  const canBridge = useSyncExternalStore(subscribe, compatibilityRoutingSupported, () => false);
  const canChoose = useSyncExternalStore(subscribe, pickerSupported, () => false) && canRoute;
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => {
    if (!open) return;
    let current = true;
    const update = () => { if (typeof navigator.mediaDevices?.enumerateDevices === "function") void audioOutputs(navigator.mediaDevices).then((next) => { if (current) { setDevices(next); setSelected(router.current?.deviceId ?? audio.current?.sinkId ?? ""); setCompatibility(router.current?.compatibility ?? false); } }).catch(() => { if (current) setMessage("Your browser could not list audio outputs. Try Refresh outputs, or use your phone’s audio controls if available."); }); };
    update(); navigator.mediaDevices?.addEventListener("devicechange", update);
    return () => { current = false; navigator.mediaDevices?.removeEventListener("devicechange", update); };
  }, [open, audio, router, revision]);
  const choose = async (deviceId?: string) => {
    if (!audio.current || busy) return;
    setBusy(true); setMessage("");
    try {
      const media = navigator.mediaDevices as OutputMediaDevices;
      const id = deviceId ?? (await media.selectAudioOutput!()).deviceId;
      if (!live.current || !audio.current) return;
      if (!router.current) throw new Error("Your partner’s audio has not connected yet.");
      await router.current.route(id);
      if (live.current) { setSelected(id); setCompatibility(router.current?.compatibility ?? false); setMessage("Output requested. Check where you hear the sound. If it hasn't changed, try compatibility audio below."); }
      void audioOutputs(media).then((next) => { if (live.current) setDevices(next); }).catch(() => {});
    } catch (error) { if (live.current) setMessage(error instanceof Error && error.name === "NotAllowedError" ? "Audio output selection wasn’t allowed. Your call continues on its current output." : "Couldn’t switch output. Use your phone’s audio controls; your call is still connected."); }
    finally { if (live.current) setBusy(false); }
  };
  const switchPlayback = async () => {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      if (!router.current) throw new Error("Wait until your partner’s audio connects, then try again.");
      if (router.current.compatibility) await router.current.useStandard();
      else await router.current.enableCompatibility();
      if (live.current) { setCompatibility(router.current?.compatibility ?? false); setSelected(router.current?.deviceId ?? ""); setMessage(router.current?.compatibility ? "Compatibility audio is on. Select an available output above and check the sound. Use normal audio if it becomes quiet or stops." : "Normal audio restored."); }
    } catch (error) { if (live.current) setMessage(error instanceof Error ? error.message : "Couldn't change playback. Try normal audio again."); }
    finally { if (live.current) { setCompatibility(router.current?.compatibility ?? false); setBusy(false); } }
  };
  return <>
    <CallControl icon="speaker" label="Audio" active={open} onClick={() => setOpen(!open)} />
    {open ? <section aria-label="Call audio output" className="mono-call-popover space-y-3 rounded-xl border border-line bg-elevated p-4 text-ink shadow-xl">
      <div className="flex items-center justify-between gap-2"><h3 className="font-medium">Speaker & audio output</h3><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Close</Button></div>
      {canRoute ? <div className="flex flex-col gap-2">{devices.map((device) => <Button key={device.deviceId} size="sm" variant="secondary" disabled={busy} aria-pressed={selected === device.deviceId} onClick={() => void choose(device.deviceId)}>{device.label}</Button>)}{canChoose ? <Button size="sm" disabled={busy} onClick={() => void choose()}>Choose audio device</Button> : null}</div> : null}
      <p className="text-xs text-muted">{canRoute ? "Only outputs offered by your browser appear here. If Speaker or Earpiece is missing, MONO cannot select it on this device." : "This browser exposes no audio-output switch to MONO. Your phone manages the route; headphones or Bluetooth may provide another output."}</p>
      {canRoute ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRevision((value) => value + 1)}>Refresh outputs</Button> : null}
      {canBridge ? <div className="space-y-2 border-t border-line pt-3"><Button size="sm" variant="secondary" disabled={busy} onClick={() => void switchPlayback()}>{compatibility ? "Use normal audio" : "Try compatibility audio"}</Button><p className="text-xs text-muted">Experimental workaround for an output switch that does nothing. It changes local playback, keeps your microphone connected, and cannot add missing outputs.</p></div> : null}
      {message ? <p role="status" className="text-sm">{message}</p> : null}
    </section> : null}
  </>;
}
