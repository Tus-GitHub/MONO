"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { togetherFetch, errorMessage } from "@/lib/together/client";
import type { CallDTO, SignalDTO } from "@/lib/together/types";
import { useVisiblePoll } from "./use-visible-poll";
import { prepareCallMedia, acquireCameraMedia, acquireScreenMedia } from "@/lib/together/call-media";
import { offerCallTracks, answerCallTracks } from "@/lib/together/call-tracks";
import { callDeadline } from "@/lib/together/call-deadline";

type Phase = "idle" | "permission" | "preparing" | "ringing" | "connecting" | "connected" | "elsewhere";
export function useCoupleCall(userId: string) {
  const [call, setCall] = useState<CallDTO | null>(null), [phase, setPhase] = useState<Phase>("idle");
  const [local, setLocal] = useState<MediaStream | null>(null), [remote, setRemote] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null), [unread, setUnread] = useState(0), [owned, setOwned] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false), [cameraOff, setCameraOff] = useState(false);
  const active = useRef<CallDTO | null>(null), peer = useRef<RTCPeerConnection | null>(null), stream = useRef<MediaStream | null>(null);
  const generation = useRef(0), starting = useRef(false), cursor = useRef("0"), heartbeat = useRef(0);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]), queue = useRef<Promise<unknown>>(Promise.resolve());
  const deadline = useRef<ReturnType<typeof callDeadline> | null>(null);
  const mediaRequest = useRef<AbortController | null>(null);
  const videoRequest = useRef<AbortController | null>(null), videoSender = useRef<RTCRtpSender | null>(null);
  const screenStream = useRef<MediaStream | null>(null), cameraWasEnabled = useRef(false);
  const [sharing, setSharing] = useState(false), [screenPreview, setScreenPreview] = useState<MediaStream | null>(null), [mediaBusy, setMediaBusy] = useState(false);
  const [screenPaused, setScreenPaused] = useState(false);
  const [screenSurface, setScreenSurface] = useState<string | undefined>(undefined);
  useEffect(() => {
    const track = screenPreview?.getVideoTracks()[0];
    if (!track) return;
    const sync = () => setScreenPaused(track.muted);
    sync(); track.addEventListener("mute", sync); track.addEventListener("unmute", sync);
    return () => { track.removeEventListener("mute", sync); track.removeEventListener("unmute", sync); };
  }, [screenPreview]);

  const release = useCallback(() => {
    generation.current++; starting.current = false; deadline.current?.stop(); deadline.current = null; mediaRequest.current?.abort(); videoRequest.current?.abort();
    for (const track of screenStream.current?.getTracks() ?? []) { track.onended = null; track.stop(); }
    screenStream.current = null; videoSender.current = null; videoRequest.current = null; setSharing(false); setScreenPreview(null); setMediaBusy(false);
    if (peer.current) { peer.current.onicecandidate = null; peer.current.onconnectionstatechange = null; peer.current.ontrack = null; peer.current.close(); peer.current = null; }
    for (const track of stream.current?.getTracks() ?? []) track.stop();
    stream.current = null; active.current = null; pendingIce.current = []; cursor.current = "0";
    setLocal(null); setRemote(null); setOwned(false); setCall(null); setPhase("idle"); setMuted(false); setCameraOff(false); setSyncError(null);
  }, []);
  const end = useCallback(async () => {
    const id = active.current?.id; release();
    if (id) try { await togetherFetch("/api/together/calls", { body: { action: "end", id } }); } catch (error) { setError(errorMessage(error)); }
  }, [release]);
  const sendSignal = useCallback((id: string, signal: { kind: string; payload: unknown }, runId: number) => {
    const work = queue.current.catch(() => {}).then(async () => {
      if (generation.current !== runId) return;
      await togetherFetch("/api/together/calls", { body: { action: "signal", id, signal } });
    });
    queue.current = work; return work;
  }, []);
  const connect = useCallback((row: CallDTO, media: MediaStream, iceServers: RTCIceServer[], runId: number) => {
    active.current = row; setCall(row); stream.current = media; setLocal(media); setOwned(true);
    cursor.current = "0"; pendingIce.current = []; queue.current = Promise.resolve(); heartbeat.current = 0;
    const pc = new RTCPeerConnection({ iceServers }); peer.current = pc;
    const received = new MediaStream();
    if (row.callerId === userId) videoSender.current = offerCallTracks(pc, media);
    setCameraOff(!media.getVideoTracks().length);
    pc.onicecandidate = (event) => { if (event.candidate) void sendSignal(row.id, { kind: "ice", payload: event.candidate.toJSON() }, runId).catch((error) => { if (generation.current === runId) { setError(errorMessage(error)); void end(); } }); };
    pc.ontrack = (event) => {
      if (generation.current !== runId) return;
      if (!received.getTracks().includes(event.track)) received.addTrack(event.track);
      setRemote(received);
    };
    deadline.current = callDeadline((reason) => {
      if (generation.current !== runId) return;
      if (reason === "unanswered") setNotice("No answer. Your partner may be away. Try calling again later.");
      else setError("The call couldn't connect after answering. Try again or switch networks.");
      void end();
    });
    deadline.current.observe(row);
    pc.onconnectionstatechange = () => {
      if (generation.current !== runId) return;
      deadline.current?.connection(pc.connectionState);
      if (pc.connectionState === "connected") setPhase("connected");
      if (pc.connectionState === "disconnected") setPhase("connecting");
    };
    return pc;
  }, [end, sendSignal, userId]);
  const mediaFor = async (kind: "AUDIO" | "VIDEO", runId: number) => {
    const controller = new AbortController(); mediaRequest.current?.abort(); mediaRequest.current = controller;
    const { media, config } = await prepareCallMedia(kind, controller.signal, () => {
      if (generation.current === runId) setPhase("preparing");
      return togetherFetch<{ iceServers: RTCIceServer[] }>("/api/together/calls?config=1", { signal: controller.signal });
    });
    if (generation.current !== runId) { media.getTracks().forEach((track) => track.stop()); return null; }
    stream.current = media; return { media, iceServers: config.iceServers };
  };
  const start = async (kind: "AUDIO" | "VIDEO") => {
    if (starting.current || active.current) return;
    starting.current = true; const runId = ++generation.current; setError(null); setNotice(null); setPhase("permission");
    try {
      const captured = await mediaFor(kind, runId); if (!captured) return;
      const row = await togetherFetch<CallDTO>("/api/together/calls", { body: { action: "start", kind, clientNonce: crypto.randomUUID() } });
      if (generation.current !== runId) { void togetherFetch("/api/together/calls", { body: { action: "end", id: row.id } }).catch(() => {}); return; }
      const pc = connect(row, captured.media, captured.iceServers, runId); setPhase("ringing");
      await pc.setLocalDescription(await pc.createOffer());
      await sendSignal(row.id, { kind: "offer", payload: { type: "offer", sdp: pc.localDescription!.sdp } }, runId);
    } catch (error) { if (generation.current === runId) { setError(errorMessage(error)); await end(); } }
    finally { starting.current = false; }
  };
  const accept = async () => {
    const incoming = active.current;
    if (!incoming || incoming.calleeId !== userId || incoming.status !== "RINGING" || starting.current) return;
    starting.current = true; const runId = ++generation.current; setError(null); setNotice(null); setPhase("permission");
    try {
      const captured = await mediaFor(incoming.kind, runId); if (!captured) return;
      const row = await togetherFetch<CallDTO>("/api/together/calls", { body: { action: "accept", id: incoming.id } });
      if (generation.current !== runId) { void togetherFetch("/api/together/calls", { body: { action: "end", id: row.id } }).catch(() => {}); return; }
      connect(row, captured.media, captured.iceServers, runId); setPhase("connecting");
    } catch (error) { if (generation.current === runId) { setError(errorMessage(error)); release(); } }
    finally { starting.current = false; }
  };
  const decline = async () => {
    const id = active.current?.id; release();
    if (id) try { await togetherFetch("/api/together/calls", { body: { action: "decline", id } }); } catch (error) { setError(errorMessage(error)); }
  };
  useEffect(() => {
    const controller = new AbortController();
    const openCall = async (id: unknown) => {
      if (typeof id !== "string" || !id || id.length > 100 || peer.current || starting.current) return;
      const runId = generation.current;
      try {
        const result = await togetherFetch<{ call: CallDTO }>(`/api/together/calls?id=${encodeURIComponent(id)}`, { signal: controller.signal });
        if (controller.signal.aborted || generation.current !== runId || peer.current || starting.current || (active.current && active.current.id !== id)) return;
        if (result.call.status === "RINGING" && result.call.calleeId === userId) {
          active.current = result.call; setCall(result.call); setNotice(null); setPhase("ringing");
        } else if (!["RINGING", "ACCEPTED"].includes(result.call.status) && !active.current) {
          setNotice("This call has ended. You can start a new call from Chat.");
        }
      } catch { if (!controller.signal.aborted && !active.current) setNotice("This call is no longer available. Open Chat to call your partner."); }
    };
    void openCall(new URL(window.location.href).searchParams.get("call"));
    const receive = (event: MessageEvent) => { if (event.data?.type === "OPEN_CALL_NOTIFICATION") void openCall(event.data.callId); };
    navigator.serviceWorker?.addEventListener("message", receive);
    return () => { controller.abort(); navigator.serviceWorker?.removeEventListener("message", receive); };
  }, [userId]);
  useVisiblePoll(async (signal) => {
    try {
      const next = await togetherFetch<{ unread: number; call: CallDTO | null }>("/api/together/status", { signal });
      if (signal.aborted) return;
      setUnread(next.unread);
      if (peer.current || starting.current) return;
      active.current = next.call; setCall(next.call);
      setPhase(next.call ? next.call.status === "RINGING" && next.call.calleeId === userId ? "ringing" : "elsewhere" : "idle");
    } catch { /* Avoid disrupting unrelated screens if live status is temporarily offline. */ }
  }, 5_000, true, true);
  useVisiblePoll(async (signal) => {
    const row = active.current, pc = peer.current, runId = generation.current;
    if (!row || !pc) return;
    try {
      const result = await togetherFetch<{ call: CallDTO; signals: SignalDTO[] }>(`/api/together/calls?id=${row.id}&after=${cursor.current}`, { signal });
      if (signal.aborted || generation.current !== runId) return;
      if (!["RINGING", "ACCEPTED"].includes(result.call.status)) {
        if (result.call.status === "MISSED") setNotice("No answer. Your partner may be away. Try calling again later.");
        if (result.call.status === "DECLINED") setNotice("Your partner declined the call.");
        release(); return;
      }
      active.current = result.call; setCall(result.call);
      deadline.current?.observe(result.call);
      if (result.call.status === "ACCEPTED" && pc.connectionState !== "connected") setPhase("connecting");
      for (const event of result.signals) {
        if (generation.current !== runId) return;
        if (event.kind === "ice") {
          if (pc.remoteDescription) await pc.addIceCandidate(event.payload as RTCIceCandidateInit); else pendingIce.current.push(event.payload as RTCIceCandidateInit);
        } else {
          await pc.setRemoteDescription(event.payload as RTCSessionDescriptionInit);
          if (generation.current !== runId) return;
          for (const candidate of pendingIce.current.splice(0)) await pc.addIceCandidate(candidate);
          if (event.kind === "offer") {
            if (!stream.current) return;
            videoSender.current = await answerCallTracks(pc, stream.current);
            if (generation.current !== runId) return;
            await pc.setLocalDescription(await pc.createAnswer());
            await sendSignal(row.id, { kind: "answer", payload: { type: "answer", sdp: pc.localDescription!.sdp } }, runId);
          }
          if (pc.connectionState !== "connected") setPhase("connecting");
        }
        cursor.current = event.id;
      }
      if (Date.now() - heartbeat.current > 15_000) { await togetherFetch("/api/together/calls", { body: { action: "heartbeat", id: row.id }, signal }); heartbeat.current = Date.now(); }
      if (!signal.aborted && generation.current === runId) setSyncError(null);
    } catch (error) { if (!signal.aborted && generation.current === runId) setSyncError(errorMessage(error)); }
  }, 1000, owned, true);
  useEffect(() => () => {
    generation.current++; mediaRequest.current?.abort(); videoRequest.current?.abort(); deadline.current?.stop(); peer.current?.close(); stream.current?.getTracks().forEach((track) => track.stop());
    screenStream.current?.getTracks().forEach((track) => { track.onended = null; track.stop(); });
    if (active.current && peer.current) void fetch("/api/together/calls", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "end", id: active.current.id }) }).catch(() => {});
  }, []);
  const toggleMute = () => { const next = !muted; stream.current?.getAudioTracks().forEach((track) => { track.enabled = !next; }); setMuted(next); };
  const stopSharing = useCallback(async () => {
    const screen = screenStream.current;
    if (!screen) return;
    const controller = new AbortController(); videoRequest.current = controller; setMediaBusy(true);
    screenStream.current = null;
    screen.getTracks().forEach((track) => { track.onended = null; track.stop(); });
    setSharing(false); setScreenPreview(null);
    const camera = stream.current?.getVideoTracks()[0] ?? null, runId = generation.current;
    if (camera) camera.enabled = cameraWasEnabled.current;
    try { await videoSender.current?.replaceTrack(camera); }
    catch { if (generation.current === runId) setError("Screen sharing stopped. Turn the camera off and on to resume video."); }
    finally { if (videoRequest.current === controller) { videoRequest.current = null; setMediaBusy(false); } }
  }, []);
  const changeVideo = async (source: "camera" | "screen") => {
    const row = active.current, sender = videoSender.current, media = stream.current, runId = generation.current;
    if (videoRequest.current || screenStream.current || !row || row.status !== "ACCEPTED" || phase !== "connected" || !sender || !media) return;
    const controller = new AbortController(); videoRequest.current = controller; setMediaBusy(true); setError(null); setNotice(null);
    let captured: MediaStream | null = null;
    try {
      captured = await (source === "screen" ? acquireScreenMedia(controller.signal) : acquireCameraMedia(controller.signal));
      if (controller.signal.aborted || generation.current !== runId) { captured.getTracks().forEach((track) => track.stop()); return; }
      const track = captured.getVideoTracks()[0];
      if (!track || track.readyState === "ended") throw new Error("No live video source was selected. Try again.");
      const updated = await togetherFetch<CallDTO>("/api/together/calls", { body: { action: "video", id: row.id }, signal: controller.signal });
      if (controller.signal.aborted || generation.current !== runId) { captured.getTracks().forEach((track) => track.stop()); return; }
      if (captured.getVideoTracks()[0]?.readyState !== "live") throw new Error("Video sharing stopped before it connected. Try again.");
      const previousTrack = sender.track;
      await sender.replaceTrack(track);
      if (controller.signal.aborted || generation.current !== runId) {
        captured.getTracks().forEach((track) => track.stop());
        if (generation.current === runId) await sender.replaceTrack(previousTrack);
        return;
      }
      active.current = updated; setCall(updated);
      if (source === "screen") {
        screenStream.current = captured;
        setScreenSurface(track.getSettings().displaySurface);
        const camera = media.getVideoTracks()[0]; cameraWasEnabled.current = camera?.enabled ?? false;
        if (camera) camera.enabled = false;
        track.onended = () => { setNotice("Your device stopped screen sharing. Your call continues; tap Share to choose a source again."); void stopSharing(); };
        setSharing(true); setScreenPreview(captured);
      } else {
        for (const old of media.getVideoTracks()) { old.stop(); media.removeTrack(old); }
        media.addTrack(track); setLocal(new MediaStream(media.getTracks())); setCameraOff(false);
      }
      captured = null;
    } catch (error) { if (!controller.signal.aborted && generation.current === runId) setError(errorMessage(error)); }
    finally { captured?.getTracks().forEach((track) => track.stop()); if (videoRequest.current === controller) { videoRequest.current = null; setMediaBusy(false); } }
  };
  const toggleCamera = async () => {
    if (screenStream.current || videoRequest.current || phase !== "connected") return;
    const media = stream.current, camera = media?.getVideoTracks()[0], runId = generation.current;
    if (!media || !camera || camera.readyState === "ended") { await changeVideo("camera"); return; }
    const controller = new AbortController(); videoRequest.current = controller; setMediaBusy(true);
    try {
      await videoSender.current?.replaceTrack(null);
      camera.stop(); media.removeTrack(camera);
      if (generation.current === runId) { setLocal(new MediaStream(media.getTracks())); setCameraOff(true); }
    } catch { if (generation.current === runId) setError("Couldn't turn off video. End the call to stop the camera."); }
    finally { if (videoRequest.current === controller) { videoRequest.current = null; setMediaBusy(false); } }
  };
  return { call, phase, local, remote, error, syncError, notice, unread, owned, muted, cameraOff, sharing, screenPaused: sharing && screenPaused, screenSurface, screenPreview, mediaBusy, start, accept, decline, end,
    toggleMute, toggleCamera, shareScreen: () => changeVideo("screen"), stopSharing, cancelMediaChange: () => videoRequest.current?.abort(), dismissError: () => { setError(null); setNotice(null); } };
}
