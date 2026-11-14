"use client";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useCoupleCall } from "@/lib/hooks/use-couple-call";
import { useCallRingtone } from "@/lib/hooks/use-call-ringtone";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useRemoteCallAudio } from "@/components/together/remote-call-audio";
import { CallControl } from "./call-control";
import { CallAudioOutput } from "./call-audio-output";

type CallContext = ReturnType<typeof useCoupleCall> & { soundsReady: boolean; enableCallSounds: () => void };
const Context = createContext<CallContext | null>(null);
const subscribeCapabilities = () => () => {};
const screenSharingAvailable = () => typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";
export function useTogetherCall() { const value = useContext(Context); if (!value) throw new Error("Chat must be inside the shared-space layout."); return value; }
export function TogetherProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const calling = useCoupleCall(userId), [hiddenFor, setHidden] = useState<string | null>(null);
  const [screenHelp, setScreenHelp] = useState(false);
  const screenSupported = useSyncExternalStore(subscribeCapabilities, screenSharingAvailable, () => false);
  const { element: partnerAudioRef, router: audioRouter, blocked: partnerAudioBlocked, resume: resumePartnerAudio } = useRemoteCallAudio(calling.owned ? calling.remote : null);
  const preparing = calling.phase === "permission" || calling.phase === "preparing";
  const id = calling.call?.id ?? (preparing ? "permission" : null);
  const incoming = calling.call?.status === "RINGING" && calling.call.calleeId === userId && !calling.owned;
  const { audioRef, blocked: ringtoneBlocked, ready: soundsReady, play: playRingtone, enable: enableCallSounds, stop: stopRingtone } = useCallRingtone(calling.call?.id, calling.call?.status === "RINGING" && calling.phase === "ringing" && (incoming || calling.owned));
  const open = Boolean((id && hiddenFor !== id) || calling.error || calling.notice);
  const close = () => { calling.dismissError(); if (id) setHidden(id); };
  const previousCall = useRef<string | null>(null);
  useEffect(() => {
    const previous = previousCall.current;
    if (previous && (previous !== calling.call?.id || calling.call?.status !== "RINGING")) {
      navigator.serviceWorker?.controller?.postMessage({ type: "CLOSE_CALL_NOTIFICATION", callId: previous });
    }
    previousCall.current = calling.call?.id ?? null;
  }, [calling.call?.id, calling.call?.status]);
  useEffect(() => {
    const receive = (event: MessageEvent) => { if (event.data?.type === "OPEN_CALL_NOTIFICATION") setHidden(null); };
    navigator.serviceWorker?.addEventListener("message", receive);
    return () => navigator.serviceWorker?.removeEventListener("message", receive);
  }, []);
  const controls = <div className={id ? "mono-call-controls relative grid grid-cols-5 items-start gap-1" : "flex justify-end"}>
    {calling.owned ? <>
      <CallControl icon={calling.muted ? "microphoneOff" : "microphone"} label={calling.muted ? "Unmute" : "Mute"} active={calling.muted} onClick={calling.toggleMute} />
      <CallControl icon="video" label={calling.call?.kind === "AUDIO" ? "Video" : calling.cameraOff ? "Camera on" : "Camera off"} active={!calling.cameraOff && !calling.sharing} disabled={calling.phase !== "connected" || calling.mediaBusy || calling.sharing} onClick={() => void calling.toggleCamera()} />
      <CallAudioOutput key={id} audio={partnerAudioRef} router={audioRouter} />
      <CallControl icon="screenShare" label={calling.sharing ? "Stop sharing" : "Share"} active={calling.sharing} disabled={calling.phase !== "connected" || calling.mediaBusy} onClick={() => { if (calling.sharing) void calling.stopSharing(); else if (screenSupported) void calling.shareScreen(); else setScreenHelp(!screenHelp); }} />
    </> : null}
    {incoming && !preparing ? <><div className="col-start-2"><CallControl icon="phoneEnd" label="Decline" tone="danger" onClick={() => { stopRingtone(); void calling.decline(); }} /></div><div className="col-start-4"><CallControl icon="phone" label="Pick up" tone="success" onClick={() => { stopRingtone(); void calling.accept(); }} /></div></>
      : calling.call || preparing ? <div className={calling.owned ? "" : "col-start-3"}><CallControl icon="phoneEnd" label={preparing ? "Cancel call" : "End call"} tone="danger" onClick={() => { stopRingtone(); void calling.end(); }} /></div> : <Button variant="secondary" onClick={close}>Close</Button>}
  </div>;
  return <Context.Provider value={{ ...calling, soundsReady, enableCallSounds }}>
    <audio ref={audioRef} preload="none" aria-label="Call ringtone" />
    <audio ref={partnerAudioRef} autoPlay aria-label="Partner call audio" />
    {children}
    {id && hiddenFor === id ? <div className="fixed right-4 bottom-[calc(var(--bottomnav-h)+1rem)] z-40 flex gap-2 lg:bottom-6"><Button className="shadow-lg" onClick={() => setHidden(null)}>Return to call</Button>{calling.sharing ? <Button variant="secondary" onClick={() => void calling.stopSharing()}>Stop sharing</Button> : null}</div> : null}
    <Modal open={open} onClose={close} size={id ? "full" : "md"} className={id ? "mono-call-panel" : undefined} closeLabel={id ? "Minimize call" : "Close"} footer={controls} title={incoming ? `Incoming ${calling.call?.kind === "VIDEO" ? "video" : "voice"} call` : calling.call?.kind === "VIDEO" ? "Your video call" : "Your call"}>
      <div className={id ? "relative flex h-full min-h-0 flex-col" : "space-y-4"}>
        {id ? <div className="absolute inset-0">
          {calling.remote && calling.call?.kind === "VIDEO" ? <CallMedia key={id} stream={calling.remote} muted partner fill /> : <div className="absolute inset-0 grid place-content-center justify-items-center gap-4 text-white"><span className="grid size-24 place-items-center rounded-full bg-white/10"><Icon name={calling.call?.kind === "VIDEO" ? "video" : "phone"} size="xl" /></span><p className="font-display text-2xl">{incoming ? "Your partner is calling" : "Just the two of you"}</p></div>}
          {calling.sharing && calling.screenPreview ? <div className="mono-call-preview"><CallMedia stream={calling.screenPreview} muted /><p className="bg-black/70 px-2 py-1 text-2xs text-white">Your shared screen</p></div>
            : calling.local && !calling.cameraOff && calling.call?.kind === "VIDEO" ? <div className="mono-call-preview"><CallMedia stream={calling.local} muted /></div> : null}
        </div> : null}
        <div className={id ? "mono-call-status relative z-10 space-y-2" : "space-y-4"}>
        {calling.error ? <p role="alert" className="text-sm text-error">{calling.error}</p> : null}
        {calling.notice ? <p role="status" className="text-sm text-muted">{calling.notice}</p> : null}
        {ringtoneBlocked ? <div className="space-y-2"><p className="text-sm text-muted">Your browser paused call sounds. Tap to hear the ringtone.</p><Button variant="secondary" leadingIcon={<Icon name="speaker" />} onClick={playRingtone}>Play ringtone</Button></div> : null}
        {calling.phase === "permission" ? <p role="status" className="text-sm text-muted">{incoming ? "Allow microphone access, and camera access for video, before answering." : "Allow microphone access, and camera access for video. Your partner has not been called yet."} You can cancel while you decide.</p> : null}
        {calling.phase === "preparing" ? <p role="status" className="text-sm text-muted">Devices ready. {incoming ? "Answering your partner…" : "Preparing your call…"}</p> : null}
        {incoming && !preparing ? <p className="text-sm text-muted">Your partner is calling. Answer when you&apos;re ready.</p> : null}
        {calling.phase === "elsewhere" ? <p className="text-sm text-muted">This call is open on another tab or device.</p> : null}
        {calling.owned ? <>
          {partnerAudioBlocked ? <Button variant="secondary" onClick={resumePartnerAudio}>Tap to hear your partner</Button> : null}
          <p role="status" className="text-sm text-muted">{calling.phase === "connected" ? "Connected · media is not recorded" : calling.phase === "ringing" ? "Calling your partner…" : "Connecting…"}</p>
          {calling.syncError ? <p role="status" className="text-xs text-muted">{calling.phase === "connected" ? "Call updates are delayed. Retrying automatically; you can stay on the call." : `${calling.syncError} Retrying call updates automatically…`}</p> : null}
          {screenHelp && !screenSupported ? <div className="rounded-xl bg-elevated p-3 text-ink"><p className="text-sm">Screen sharing isn’t offered by this browser. There is no screen permission for MONO to request here. You can still view your partner’s screen; use MONO on a supported desktop browser to share yours.</p><Button size="sm" variant="ghost" onClick={() => setScreenHelp(false)}>Got it</Button></div> : null}
          {calling.mediaBusy ? <div className="space-y-2"><p role="status" className="text-sm text-muted">Choose what to share in your browser. Your current call continues.</p><Button variant="ghost" onClick={calling.cancelMediaChange}>Cancel video change</Button></div> : null}
          {calling.sharing ? <p role="status" className="text-xs text-muted">{calling.screenPaused ? "Screen sharing is paused by your device. Return to the shared app or stop and share again." : `${calling.screenSurface === "browser" ? "Sharing the selected browser tab, not other apps." : calling.screenSurface === "window" ? "Sharing the selected window, not the whole screen." : "Sharing the source you selected."} Keep MONO open; your phone may pause capture when you switch apps or lock it. Screen audio is off.`}</p> : null}
        </> : null}
        </div>
      </div>
    </Modal>
  </Context.Provider>;
}
function CallMedia({ stream, muted = false, partner = false, fill = false }: { stream: MediaStream; muted?: boolean; partner?: boolean; fill?: boolean }) {
  const element = useRef<HTMLVideoElement | null>(null), [needsPlay, setNeedsPlay] = useState(false), [cover, setCover] = useState(false);
  useEffect(() => { const media = element.current; if (!media) return; media.srcObject = stream; void media.play().catch(() => setNeedsPlay(true)); return () => { media.srcObject = null; }; }, [stream]);
  return <div className={fill ? "absolute inset-0" : "relative"}>
    {/* Live peer media has no prerecorded caption track. */}
    <video ref={element} autoPlay playsInline muted={muted} aria-label={partner ? "Partner live video" : "Your camera preview"} className={fill ? `mono-call-video ${cover ? "h-full w-full object-cover" : "mono-call-video-fit object-contain"}` : "aspect-video w-full bg-(--photo-backdrop) object-contain"} />
    {fill ? <div className="mono-call-view-control"><Button size="sm" variant="secondary" leadingIcon={<Icon name="expand" />} aria-pressed={cover} onClick={() => setCover(!cover)}>{cover ? "Fit whole view" : "Fill screen"}</Button></div> : null}
    {needsPlay ? <Button className="absolute top-1/2 left-3" variant="secondary" onClick={() => void element.current?.play().then(() => setNeedsPlay(false)).catch(() => {})}>Play video</Button> : null}
  </div>;
}
