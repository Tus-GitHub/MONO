"use client";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useCoupleCall } from "@/lib/hooks/use-couple-call";
import { useCallRingtone } from "@/lib/hooks/use-call-ringtone";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useRemoteCallAudio } from "@/components/together/remote-call-audio";

type CallContext = ReturnType<typeof useCoupleCall> & { soundsReady: boolean; enableCallSounds: () => void };
const Context = createContext<CallContext | null>(null);
const subscribeCapabilities = () => () => {};
const screenSharingAvailable = () => typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";
export function useTogetherCall() { const value = useContext(Context); if (!value) throw new Error("Chat must be inside the shared-space layout."); return value; }
export function TogetherProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const calling = useCoupleCall(userId), [hiddenFor, setHidden] = useState<string | null>(null);
  const screenSupported = useSyncExternalStore(subscribeCapabilities, screenSharingAvailable, () => false);
  const { element: partnerAudioRef, blocked: partnerAudioBlocked, resume: resumePartnerAudio } = useRemoteCallAudio(calling.owned ? calling.remote : null);
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
  const controls = <div className="flex flex-wrap items-center justify-center gap-2">
    {calling.owned ? <>
      <Button variant="secondary" onClick={calling.toggleMute}>{calling.muted ? "Unmute" : "Mute"}</Button>
      <Button variant="secondary" leadingIcon={<Icon name="video" />} disabled={calling.phase !== "connected" || calling.mediaBusy || calling.sharing} onClick={() => void calling.toggleCamera()}>{calling.call?.kind === "AUDIO" ? "Video" : calling.cameraOff ? "Camera on" : "Camera off"}</Button>
      {calling.sharing ? <Button variant="secondary" onClick={() => void calling.stopSharing()}>Stop sharing</Button> : screenSupported ? <Button variant="secondary" disabled={calling.phase !== "connected" || calling.mediaBusy} onClick={() => void calling.shareScreen()}>Share screen</Button> : null}
    </> : null}
    {incoming && !preparing ? <><Button variant="danger" leadingIcon={<Icon name="phoneEnd" />} onClick={() => { stopRingtone(); void calling.decline(); }}>Decline</Button><Button variant="success" leadingIcon={<Icon name="phone" />} onClick={() => { stopRingtone(); void calling.accept(); }}>Pick up</Button></>
      : calling.call || preparing ? <Button variant="danger" leadingIcon={<Icon name="phoneEnd" />} onClick={() => { stopRingtone(); void calling.end(); }}>{preparing ? "Cancel call" : "End call"}</Button> : <Button variant="secondary" onClick={close}>Close</Button>}
  </div>;
  return <Context.Provider value={{ ...calling, soundsReady, enableCallSounds }}>
    <audio ref={audioRef} preload="none" aria-label="Call ringtone" />
    <audio ref={partnerAudioRef} autoPlay aria-label="Partner call audio" />
    {children}
    {id && hiddenFor === id ? <div className="fixed right-4 bottom-[calc(var(--bottomnav-h)+1rem)] z-40 flex gap-2 lg:bottom-6"><Button className="shadow-lg" onClick={() => setHidden(null)}>Return to call</Button>{calling.sharing ? <Button variant="secondary" onClick={() => void calling.stopSharing()}>Stop sharing</Button> : null}</div> : null}
    <Modal open={open} onClose={close} size={id ? "full" : "md"} closeLabel={id ? "Minimize call" : "Close"} footer={controls} title={incoming ? `Incoming ${calling.call?.kind === "VIDEO" ? "video" : "voice"} call` : calling.call?.kind === "VIDEO" ? "Your video call" : "Your call"}>
      <div className={id ? "flex h-full flex-col gap-3" : "space-y-4"}>
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
          <div className="relative min-h-40 flex-1 overflow-hidden rounded-xl bg-(--photo-backdrop)">
            {calling.remote && calling.call?.kind === "VIDEO" ? <CallMedia stream={calling.remote} muted partner fill /> : <div className="absolute inset-0 grid place-content-center justify-items-center gap-4 text-primary-fg"><Icon name={calling.call?.kind === "VIDEO" ? "video" : "phone"} size="xl" /><p>{calling.call?.kind === "VIDEO" ? "Waiting for your partner’s camera" : "Just the two of you"}</p></div>}
            {calling.sharing && calling.screenPreview ? <div className="absolute right-3 bottom-3 w-28 overflow-hidden rounded-lg border border-line bg-elevated shadow-lg sm:w-44"><CallMedia stream={calling.screenPreview} muted /><p className="px-2 py-1 text-2xs text-ink">Your shared screen</p></div>
              : calling.local && !calling.cameraOff && calling.call?.kind === "VIDEO" ? <div className="absolute right-3 bottom-3 w-24 overflow-hidden rounded-lg border border-line shadow-lg sm:w-40"><CallMedia stream={calling.local} muted /></div> : null}
          </div>
          {!screenSupported ? <p className="text-xs text-muted">This browser cannot share your screen. You can still view a screen shared by your partner.</p> : null}
          {calling.mediaBusy ? <div className="space-y-2"><p role="status" className="text-sm text-muted">Choose what to share in your browser. Your current call continues.</p><Button variant="ghost" onClick={calling.cancelMediaChange}>Cancel video change</Button></div> : null}
          {calling.sharing ? <p className="text-xs text-muted">Only the screen, window or tab you chose is shared. Screen audio is off; your microphone follows the mute control.</p> : null}
        </> : null}
      </div>
    </Modal>
  </Context.Provider>;
}
function CallMedia({ stream, muted = false, partner = false, fill = false }: { stream: MediaStream; muted?: boolean; partner?: boolean; fill?: boolean }) {
  const element = useRef<HTMLVideoElement | null>(null), [needsPlay, setNeedsPlay] = useState(false);
  useEffect(() => { const media = element.current; if (!media) return; media.srcObject = stream; void media.play().catch(() => setNeedsPlay(true)); return () => { media.srcObject = null; }; }, [stream]);
  return <div className={fill ? "absolute inset-0" : "relative"}>
    {/* Live peer media has no prerecorded caption track. */}
    <video ref={element} autoPlay playsInline muted={muted} aria-label={partner ? "Partner live video" : "Your camera preview"} className={fill ? "h-full w-full object-contain" : "aspect-video w-full bg-(--photo-backdrop) object-contain"} />
    {needsPlay ? <Button className="absolute bottom-3 left-3" variant="secondary" onClick={() => void element.current?.play().then(() => setNeedsPlay(false)).catch(() => {})}>Play video</Button> : null}
  </div>;
}
