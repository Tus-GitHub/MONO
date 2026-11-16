"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useCallPictureInPicture } from "@/lib/hooks/use-call-picture-in-picture";
import { leaveCallPip } from "@/lib/together/picture-in-picture";

export function CallVideoStage({ local, remote, sharing, connected, controlsVisible, canHideControls, onToggleControls, minimized = false }: {
  local: MediaStream | null; remote: MediaStream | null; sharing: boolean; connected: boolean;
  controlsVisible: boolean; canHideControls: boolean; onToggleControls: (fromKeyboard?: boolean) => void;
  minimized?: boolean;
}) {
  const [selfMain, setSelfMain] = useState(false), [cover, setCover] = useState(false);
  const toggleButton = useRef<HTMLButtonElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const pip = useCallPictureInPicture(remoteVideo, connected && !!remote);
  const wasMinimized = useRef(minimized);
  useEffect(() => {
    if (wasMinimized.current && !minimized && remoteVideo.current) void leaveCallPip(remoteVideo.current).catch(() => {});
    wasMinimized.current = minimized;
  }, [minimized]);
  const swapButton = useRef<HTMLButtonElement>(null), restoreSwapFocus = useRef(false);
  const localIsMain = (minimized ? !remote : selfMain) && Boolean(local);
  const canSwap = !minimized && connected && Boolean(local && remote);
  const swap = () => { restoreSwapFocus.current = true; setSelfMain((value) => !value); };
  useEffect(() => {
    if (!restoreSwapFocus.current) return;
    restoreSwapFocus.current = false;
    (swapButton.current ?? toggleButton.current)?.focus({ preventScroll: true });
  }, [localIsMain]);
  useEffect(() => {
    // An auto-hidden toolbar must not leave keyboard focus behind in inert chrome.
    const focused = document.activeElement;
    if (!minimized && !controlsVisible && (focused === document.body || focused instanceof HTMLElement && focused.closest("[inert]"))) {
      toggleButton.current?.focus({ preventScroll: true });
    }
  }, [controlsVisible, minimized]);
  return <div className="mono-call-video-stage absolute inset-0" aria-label="Video call views">
    {!remote && !localIsMain ? <div className="absolute inset-0 grid place-content-center justify-items-center gap-4 text-white">
      <span className="grid size-24 place-items-center rounded-full bg-white/10"><Icon name="video" size="xl" /></span>
      <p className="font-display text-2xl">Just the two of you</p>
    </div> : null}
    {/* Keep each participant's player mounted in place. Swapping only changes layout. */}
    {remote ? <VideoView stream={remote} videoRef={remoteVideo} label="Partner" main={!localIsMain} cover={cover} canSwap={canSwap} onSwap={swap} swapButton={swapButton} /> : null}
    {local ? <VideoView stream={local} label={sharing ? "Your shared screen" : "You"} main={localIsMain} cover={cover} canSwap={canSwap} onSwap={swap} swapButton={swapButton} /> : null}
    {canHideControls ? <button ref={toggleButton} type="button" className="mono-call-stage-toggle" aria-label={controlsVisible ? "Hide call controls" : "Show call controls"}
      aria-pressed={controlsVisible} onClick={(event) => onToggleControls(event.detail === 0)} /> : null}
    {remote || localIsMain ? <div className="mono-call-view-control mono-call-chrome" inert={!controlsVisible} aria-hidden={!controlsVisible}>
      <Button size="sm" variant="secondary" leadingIcon={<Icon name="expand" />} aria-pressed={cover} onClick={() => setCover(!cover)}>{cover ? "Fit whole view" : "Fill screen"}</Button>
      {pip.supported ? <Button size="sm" variant="secondary" leadingIcon={<Icon name="pictureInPicture" />} onClick={pip.toggle}>{pip.outside ? "Bring video back" : "Pop out video"}</Button> : null}
      {pip.error ? <p role="status" className="rounded-lg bg-elevated p-2 text-xs text-ink">{pip.error}</p> : null}
    </div> : null}
    {minimized && pip.supported ? <Button size="icon" variant="secondary" className="mono-call-mini-pip" aria-label={pip.outside ? "Bring video back" : "Pop out video"} title={pip.outside ? "Bring video back" : "Pop out video"} onClick={pip.toggle}><Icon name="pictureInPicture" size="sm" /></Button> : null}
    {minimized && pip.error ? <span role="status" className="mono-call-mini-error">{pip.error}</span> : null}
  </div>;
}

function VideoView({ stream, label, main, cover, canSwap, onSwap, swapButton, videoRef }: {
  stream: MediaStream; label: string; main: boolean; cover: boolean; canSwap: boolean; onSwap: () => void;
  swapButton: RefObject<HTMLButtonElement | null>;
  videoRef?: RefObject<HTMLVideoElement | null>;
}) {
  const ownElement = useRef<HTMLVideoElement>(null), element = videoRef ?? ownElement;
  const [blockedStream, setBlockedStream] = useState<MediaStream | null>(null);
  useEffect(() => {
    const media = element.current;
    if (!media) return;
    let live = true;
    media.srcObject = stream;
    void media.play().then(() => { if (live) setBlockedStream(null); }).catch(() => { if (live) setBlockedStream(stream); });
    return () => { live = false; media.srcObject = null; };
  }, [stream, element]);
  const needsPlay = blockedStream === stream;
  return <div className={main ? "mono-call-main-video" : "mono-call-preview"} data-call-participant={label === "Partner" ? "partner" : "self"} data-main={main}>
    {/* Audio stays on the provider's persistent audio element, including after a swap. */}
    <video ref={element} autoPlay playsInline muted aria-label={label === "Partner" ? "Partner live video" : label === "You" ? "Your camera preview" : label}
      className={`mono-call-video h-full w-full bg-(--photo-backdrop) ${main && cover ? "object-cover" : "object-contain"}`} />
    {!main ? <>
      {canSwap ? <button ref={swapButton} type="button" className="mono-call-swap-target" aria-label={label === "Partner" ? "Make your partner's video the main view" : "Make your video the main view"} onClick={onSwap} /> : null}
      <span className="mono-call-preview-label"><span className="min-w-0 truncate">{label}</span>{canSwap ? <span className="inline-flex shrink-0 items-center gap-1"><Icon name="refresh" size={12} />Swap</span> : null}</span>
    </> : null}
    {needsPlay ? <Button className="mono-call-play" size="sm" variant="secondary" onClick={() => void element.current?.play().then(() => setBlockedStream(null)).catch(() => {})}>Play video</Button> : null}
  </div>;
}
