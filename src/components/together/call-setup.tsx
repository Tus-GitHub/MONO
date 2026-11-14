"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Icon } from "@/components/ui/icon";
import { EnableBrowserNotifications } from "@/components/settings/enable-browser-notifications";
import { acquireCallMedia, acquireCameraMedia } from "@/lib/together/call-media";
import { errorMessage } from "@/lib/together/client";

export function CallSetup({ soundsReady, enableSounds }: { soundsReady: boolean; enableSounds: () => void }) {
  const [open, setOpen] = useState(false), [mic, setMic] = useState(false), [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const close = () => { request.current?.abort(); request.current = null; setBusy(false); setOpen(false); };
  const check = async (kind: "microphone" | "camera") => {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError(null);
    try {
      const media = await (kind === "microphone" ? acquireCallMedia("AUDIO", controller.signal) : acquireCameraMedia(controller.signal));
      media.getTracks().forEach((track) => track.stop());
      if (!controller.signal.aborted) { if (kind === "microphone") setMic(true); else setCamera(true); }
    } catch (error) { if (!controller.signal.aborted) setError(errorMessage(error)); }
    finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  };
  return <>
    <Button size="sm" variant="secondary" leadingIcon={<Icon name="phone" />} onClick={() => setOpen(true)}>Set up calling</Button>
    <Modal open={open} onClose={close} title="Set up calling">
      <div className="space-y-4">
        <p className="text-sm text-muted">Both partners should do this on their own device before calling. These checks stop the microphone and camera immediately; they do not call your partner.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => void check("microphone")}>{mic ? "Microphone checked" : "Enable microphone"}</Button>
          <Button variant="secondary" disabled={busy} onClick={() => void check("camera")}>{camera ? "Camera checked" : "Enable camera (optional)"}</Button>
          <Button variant="secondary" disabled={busy} leadingIcon={<Icon name="speaker" />} onClick={enableSounds}>{soundsReady ? "Test ringtone" : "Enable call sounds"}</Button>
        </div>
        {busy ? <p role="status" className="text-sm text-muted">Allow access in your browser to finish this check.</p> : null}
        {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
        <EnableBrowserNotifications purpose="calls" />
        <p className="text-xs text-muted">When MONO is closed, tap the notification to open and answer. Phone settings control notification sounds. Your song plays inside MONO.</p>
        <Button variant="secondary" onClick={close}>{busy ? "Cancel setup" : "Done"}</Button>
      </div>
    </Modal>
  </>;
}
