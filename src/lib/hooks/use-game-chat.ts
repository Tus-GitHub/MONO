"use client";
import { useEffect, useRef, useState } from "react";
import { togetherFetch, transientTogetherError } from "@/lib/together/client";
import { retryDelay } from "@/lib/together/recovery";

export interface GameChatMessage { id: string; text: string; mine: boolean; delivered: boolean }
interface Signal { id: string; sessionId: string; targetSessionId: string | null; kind: "hello" | "offer" | "answer" | "ice"; payload: RTCSessionDescriptionInit | RTCIceCandidateInit }
interface Snapshot { active: boolean; iceServers: RTCIceServer[]; signals: Signal[] }
const endpoint = "/api/together/games/chat";

/** Text only exists in this hook and the encrypted peer data channel. No storage/API fallback. */
export function useGameChat(gameId: string, initiator: boolean, callChannel: RTCDataChannel | null = null) {
  const [messages, setMessages] = useState<GameChatMessage[]>([]);
  const [phase, setPhase] = useState("connecting"), [generation, setGeneration] = useState(0);
  const channel = useRef<RTCDataChannel | null>(null), lastSend = useRef(0);
  const attempts = useRef(0);
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  // Rebuild only a failed peer, with a grace period for brief mobile network changes.
  useEffect(() => {
    if (phase === "connected") { attempts.current = 0; return; }
    if (["ended", "blocked", "away"].includes(phase) || callChannel?.readyState === "open") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const due = Date.now() + (phase === "connecting" ? (initiator ? 45_000 : 50_000) : Math.min(30_000, 8000 * 2 ** Math.min(attempts.current, 2)));
    const restart = () => {
      if (document.hidden || navigator.onLine === false) return;
      attempts.current++; setPhase("connecting"); setGeneration(value => value + 1);
    };
    const schedule = () => { clearTimeout(timer); if (!document.hidden && navigator.onLine !== false) timer = setTimeout(restart, Math.max(0, due - Date.now())); };
    schedule(); document.addEventListener("visibilitychange", schedule); window.addEventListener("online", schedule);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", schedule); window.removeEventListener("online", schedule); };
  }, [phase, generation, initiator, callChannel]);
  useEffect(() => {
    const controller = new AbortController(), sessionId = crypto.randomUUID();
    let stopped = false, polling = false, failures = 0, cursor = "0", peerId = "", pc: RTCPeerConnection | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined, queue = Promise.resolve();
    let detachChannel = () => {};
    const shared = callChannel?.readyState === "open";
    let servers: RTCIceServer[] = [], candidates: RTCIceCandidateInit[] = [];
    const closePeer = () => { detachChannel(); const old = pc; pc = null; if (channel.current !== callChannel) channel.current?.close(); channel.current = null; old?.close(); candidates = []; };
    const stop = () => { stopped = true; controller.abort(); clearTimeout(timer); closePeer(); };
    const fail = (error?: unknown) => {
      if (stopped) return;
      if (error !== undefined && !transientTogetherError(error)) { setPhase("blocked"); stop(); return; }
      // Late ICE/signaling failures must not kill an already-working data channel.
      if (channel.current?.readyState === "open") return;
      setPhase("error"); stop();
    };
    const post = (kind: Signal["kind"], payload: object, target = peerId) => {
      const work = queue.then(async () => {
        if (stopped) return;
        await togetherFetch(endpoint, { signal: controller.signal, body: { gameId, sessionId, ...(kind === "hello" ? {} : { targetSessionId: target }), signal: { kind, payload } } });
      });
      queue = work.catch(() => {}); return work;
    };
    const bind = (next: RTCDataChannel, owner: RTCPeerConnection | null, usingCall = false) => {
      if (!usingCall && next.label !== "mono-match-chat") { next.close(); return; }
      detachChannel();
      channel.current = next;
      const current = () => !stopped && (usingCall ? channel.current === next : pc === owner);
      let peerPresent = !usingCall, peerSeenAt = Date.now(), remoteSession = "";
      const replayed = new Set<string>();
      const flush = () => {
        if (!current() || !peerPresent || next.readyState !== "open") return;
        for (const message of messagesRef.current) {
          if (!message.mine || message.delivered || replayed.has(message.id)) continue;
          if (next.bufferedAmount > 64 * 1024) break;
          try { next.send(JSON.stringify({ type: "message", gameId, id: message.id, text: message.text })); replayed.add(message.id); } catch { break; }
        }
      };
      next.bufferedAmountLowThreshold = 16 * 1024; next.onbufferedamountlow = flush;
      next.onopen = () => { if (current() && peerPresent) { setPhase("connected"); flush(); } };
      next.onclose = () => { if (current()) setPhase("waiting"); };
      next.onerror = () => { if (current()) setPhase("error"); };
      next.onmessage = event => {
        if (!current() || typeof event.data !== "string" || event.data.length > 6000) return;
        try {
          const data = JSON.parse(event.data);
          if ((usingCall || data.gameId !== undefined) && data.gameId !== gameId) return;
          if (typeof data.id !== "string" || !/^[a-f0-9-]{36}$/.test(data.id)) return;
          if (usingCall && ["join", "joined", "leave"].includes(data.type)) {
            if (data.type === "leave") { if (data.id === remoteSession) { peerPresent = false; setPhase("away"); } return; }
            if (remoteSession !== data.id) replayed.clear();
            remoteSession = data.id; peerPresent = true; peerSeenAt = Date.now();
            if (data.type === "join") next.send(JSON.stringify({ type: "joined", gameId, id: sessionId }));
            setPhase("connected"); flush(); return;
          }
          if (data.type === "ack") { setMessages(rows => rows.map(row => row.mine && row.id === data.id ? { ...row, delivered: true } : row)); return; }
          if (data.type !== "message" || typeof data.text !== "string" || !data.text.trim() || data.text.length > 1000) return;
          setMessages(rows => rows.some(row => row.id === data.id) ? rows : [...rows, { id: data.id, text: data.text, mine: false, delivered: true }].slice(-100));
          if (next.readyState === "open") next.send(JSON.stringify({ type: "ack", gameId, id: data.id }));
        } catch { /* Ignore malformed peer packets; never render peer HTML. */ }
      };
      const join = () => {
        if (!current() || next.readyState !== "open") return;
        try { next.send(JSON.stringify({ type: "join", gameId, id: sessionId })); } catch { setPhase("waiting"); }
        if (Date.now() - peerSeenAt > 45_000) { peerPresent = false; setPhase("away"); }
      };
      const presence = usingCall ? setInterval(join, 2000) : undefined;
      if (usingCall) { setPhase("away"); join(); }
      else if (next.readyState === "open") { setPhase("connected"); flush(); }
      detachChannel = () => {
        clearInterval(presence);
        if (usingCall && next.readyState === "open") try { next.send(JSON.stringify({ type: "leave", gameId, id: sessionId })); } catch { /* Call may be closing. */ }
        next.onopen = null; next.onclose = null; next.onerror = null; next.onmessage = null; next.onbufferedamountlow = null;
      };
    };
    const connect = async (id: string) => {
      closePeer(); peerId = id; setPhase("connecting");
      const next = new RTCPeerConnection({ iceServers: servers }); pc = next;
      next.ondatachannel = event => { if (pc === next && !stopped) bind(event.channel, next); };
      next.onicecandidate = event => { if (event.candidate && pc === next && !stopped) void post("ice", event.candidate.toJSON(), id).catch(fail); };
      next.onconnectionstatechange = () => {
        if (pc !== next || stopped) return;
        if (next.connectionState === "connected" && channel.current?.readyState === "open") setPhase("connected");
        else if (["disconnected", "failed", "closed"].includes(next.connectionState)) setPhase("waiting");
      };
      if (initiator) {
        bind(next.createDataChannel("mono-match-chat", { ordered: true }), next);
        await next.setLocalDescription(await next.createOffer());
        await post("offer", { type: "offer", sdp: next.localDescription!.sdp }, id);
      }
    };
    const receive = async (signal: Signal) => {
      if (signal.kind === "hello") {
        if (peerId !== signal.sessionId) { await post("hello", {}); await connect(signal.sessionId); }
        return;
      }
      if (signal.targetSessionId !== sessionId || signal.sessionId !== peerId || !pc) return;
      if (signal.kind === "offer" && !initiator) {
        // A retried/late offer for the same session is already applied.
        if (pc.remoteDescription?.sdp === (signal.payload as RTCSessionDescriptionInit).sdp && pc.signalingState === "stable") {
          if (pc.localDescription?.type === "answer") await post("answer", { type: "answer", sdp: pc.localDescription.sdp });
          return;
        }
        await pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
        for (const candidate of candidates.splice(0)) await pc.addIceCandidate(candidate);
        await pc.setLocalDescription(await pc.createAnswer());
        await post("answer", { type: "answer", sdp: pc.localDescription!.sdp });
      } else if (signal.kind === "answer" && initiator && pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
        for (const candidate of candidates.splice(0)) await pc.addIceCandidate(candidate);
      } else if (signal.kind === "ice") {
        if (pc.remoteDescription) await pc.addIceCandidate(signal.payload as RTCIceCandidateInit).catch(() => {});
        else candidates.push(signal.payload as RTCIceCandidateInit);
      }
    };
    const poll = async () => {
      if (stopped || polling) return;
      clearTimeout(timer);
      if (navigator.onLine === false) return;
      polling = true;
      try {
        const data = await togetherFetch<Snapshot>(`${endpoint}?id=${gameId}&after=${cursor}`, { signal: controller.signal });
        if (stopped) return;
        if (!data.active) { setMessages([]); setPhase("ended"); stop(); return; }
        servers = data.iceServers; failures = 0;
        // Recovery can return several historic sessions. Negotiate only the latest greeting.
        const hello = data.signals.filter(signal => signal.kind === "hello").at(-1);
        if (!shared) for (const signal of data.signals) {
          if (stopped) return;
          if (signal.kind !== "hello" || signal === hello) await receive(signal);
          cursor = signal.id;
        }
        if (!stopped) timer = setTimeout(() => void poll(), channel.current?.readyState === "open" ? 2000 : 700);
      } catch (error) {
        if (stopped) return;
        if (!transientTogetherError(error)) { fail(error); return; }
        // Retry HTTP independently. The peer channel and pending texts stay intact.
        failures++;
        timer = setTimeout(() => void poll(), retryDelay(failures));
      } finally { polling = false; }
    };
    void (async () => {
      try { if (shared && callChannel) bind(callChannel, null, true); else { await post("hello", {}); setPhase("connecting"); } if (!stopped) await poll(); } catch (error) { fail(error); }
    })();
    const pageHide = () => { setMessages([]); setPhase("waiting"); stop(); };
    const restored = (event: PageTransitionEvent) => { if (event.persisted && stopped) { setPhase("connecting"); setGeneration(value => value + 1); } };
    const wake = () => { if (!document.hidden && !stopped) void poll(); };
    window.addEventListener("pagehide", pageHide); window.addEventListener("pageshow", restored); window.addEventListener("online", wake); document.addEventListener("visibilitychange", wake);
    return () => { window.removeEventListener("pagehide", pageHide); window.removeEventListener("pageshow", restored); window.removeEventListener("online", wake); document.removeEventListener("visibilitychange", wake); stop(); };
  }, [gameId, initiator, generation, callChannel]);
  const send = (text: string) => {
    const value = text.trim(), current = channel.current;
    if (phase !== "connected" || !value || value.length > 1000 || current?.readyState !== "open" || current.bufferedAmount > 64 * 1024 || Date.now() - lastSend.current < 250) return false;
    const id = crypto.randomUUID();
    try {
      current.send(JSON.stringify({ type: "message", gameId, id, text: value })); lastSend.current = Date.now();
      setMessages(rows => [...rows, { id, text: value, mine: true, delivered: false }].slice(-100)); return true;
    } catch { setPhase("error"); return false; }
  };
  return { messages, phase, send, transport: callChannel?.readyState === "open" ? "call" : "standalone", reconnect: () => setGeneration(value => value + 1) };
}
