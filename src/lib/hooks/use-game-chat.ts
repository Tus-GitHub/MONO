"use client";
import { useEffect, useRef, useState } from "react";
import { togetherFetch } from "@/lib/together/client";

export interface GameChatMessage { id: string; text: string; mine: boolean; delivered: boolean }
interface Signal { id: string; sessionId: string; targetSessionId: string | null; kind: "hello" | "offer" | "answer" | "ice"; payload: RTCSessionDescriptionInit | RTCIceCandidateInit }
interface Snapshot { active: boolean; iceServers: RTCIceServer[]; signals: Signal[] }
const endpoint = "/api/together/games/chat";

/** Text only exists in this hook and the encrypted peer data channel. No storage/API fallback. */
export function useGameChat(gameId: string, initiator: boolean) {
  const [messages, setMessages] = useState<GameChatMessage[]>([]);
  const [phase, setPhase] = useState("connecting"), [generation, setGeneration] = useState(0);
  const channel = useRef<RTCDataChannel | null>(null), lastSend = useRef(0);
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  // A temporary API/network failure must not leave the composer disconnected forever.
  useEffect(() => {
    if (phase === "connected" || phase === "ended") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const restart = () => { if (!document.hidden) { setPhase("connecting"); setGeneration(value => value + 1); } };
    if (!document.hidden) timer = setTimeout(restart, phase === "connecting" ? (initiator ? 30_000 : 34_000) : 3000);
    const visible = () => { if (!document.hidden) restart(); };
    document.addEventListener("visibilitychange", visible); window.addEventListener("online", restart);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", visible); window.removeEventListener("online", restart); };
  }, [phase, generation, initiator]);
  useEffect(() => {
    const controller = new AbortController(), sessionId = crypto.randomUUID();
    let stopped = false, cursor = "0", peerId = "", pc: RTCPeerConnection | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined, queue = Promise.resolve();
    let servers: RTCIceServer[] = [], candidates: RTCIceCandidateInit[] = [];
    const closePeer = () => { const old = pc; pc = null; channel.current?.close(); channel.current = null; old?.close(); candidates = []; };
    const stop = () => { stopped = true; controller.abort(); clearTimeout(timer); closePeer(); };
    const fail = () => { if (!stopped) { setPhase("error"); stop(); } };
    const post = (kind: Signal["kind"], payload: object, target = peerId) => {
      const work = queue.then(async () => {
        if (stopped) return;
        await togetherFetch(endpoint, { signal: controller.signal, body: { gameId, sessionId, ...(kind === "hello" ? {} : { targetSessionId: target }), signal: { kind, payload } } });
      });
      queue = work.catch(() => {}); return work;
    };
    const bind = (next: RTCDataChannel, owner: RTCPeerConnection) => {
      if (next.label !== "mono-match-chat") { next.close(); return; }
      channel.current = next;
      const replayed = new Set<string>();
      const flush = () => {
        if (stopped || pc !== owner || next.readyState !== "open") return;
        for (const message of messagesRef.current) {
          if (!message.mine || message.delivered || replayed.has(message.id)) continue;
          if (next.bufferedAmount > 64 * 1024) break;
          try { next.send(JSON.stringify({ type: "message", id: message.id, text: message.text })); replayed.add(message.id); } catch { break; }
        }
      };
      next.bufferedAmountLowThreshold = 16 * 1024; next.onbufferedamountlow = flush;
      next.onopen = () => { if (!stopped && pc === owner) { setPhase("connected"); flush(); } };
      next.onclose = () => { if (!stopped && pc === owner) setPhase("waiting"); };
      next.onerror = () => { if (!stopped && pc === owner) setPhase("error"); };
      next.onmessage = event => {
        if (stopped || pc !== owner || typeof event.data !== "string" || event.data.length > 6000) return;
        try {
          const data = JSON.parse(event.data);
          if (typeof data.id !== "string" || !/^[a-f0-9-]{36}$/.test(data.id)) return;
          if (data.type === "ack") { setMessages(rows => rows.map(row => row.mine && row.id === data.id ? { ...row, delivered: true } : row)); return; }
          if (data.type !== "message" || typeof data.text !== "string" || !data.text.trim() || data.text.length > 1000) return;
          setMessages(rows => rows.some(row => row.id === data.id) ? rows : [...rows, { id: data.id, text: data.text, mine: false, delivered: true }].slice(-100));
          if (next.readyState === "open") next.send(JSON.stringify({ type: "ack", id: data.id }));
        } catch { /* Ignore malformed peer packets; never render peer HTML. */ }
      };
    };
    const connect = async (id: string) => {
      closePeer(); peerId = id; setPhase("connecting");
      const next = new RTCPeerConnection({ iceServers: servers }); pc = next;
      next.ondatachannel = event => { if (pc === next && !stopped) bind(event.channel, next); };
      next.onicecandidate = event => { if (event.candidate && pc === next && !stopped) void post("ice", event.candidate.toJSON(), id).catch(fail); };
      next.onconnectionstatechange = () => { if (pc === next && !stopped && ["disconnected", "failed", "closed"].includes(next.connectionState)) setPhase("waiting"); };
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
        await pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
        for (const candidate of candidates.splice(0)) await pc.addIceCandidate(candidate);
        await pc.setLocalDescription(await pc.createAnswer());
        await post("answer", { type: "answer", sdp: pc.localDescription!.sdp });
      } else if (signal.kind === "answer" && initiator && pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
        for (const candidate of candidates.splice(0)) await pc.addIceCandidate(candidate);
      } else if (signal.kind === "ice") {
        if (pc.remoteDescription) await pc.addIceCandidate(signal.payload as RTCIceCandidateInit);
        else candidates.push(signal.payload as RTCIceCandidateInit);
      }
    };
    const poll = async () => {
      try {
        const data = await togetherFetch<Snapshot>(`${endpoint}?id=${gameId}&after=${cursor}`, { signal: controller.signal });
        if (stopped) return;
        if (!data.active) { setMessages([]); setPhase("ended"); stop(); return; }
        servers = data.iceServers;
        for (const signal of data.signals) { if (stopped) return; await receive(signal); cursor = signal.id; }
        if (!stopped) timer = setTimeout(() => void poll(), channel.current?.readyState === "open" ? 2000 : 700);
      } catch { fail(); }
    };
    void (async () => {
      try { await post("hello", {}); if (!stopped) { setPhase("connecting"); await poll(); } } catch { fail(); }
    })();
    const pageHide = () => { setMessages([]); setPhase("waiting"); stop(); };
    window.addEventListener("pagehide", pageHide);
    return () => { window.removeEventListener("pagehide", pageHide); stop(); };
  }, [gameId, initiator, generation]);
  const send = (text: string) => {
    const value = text.trim(), current = channel.current;
    if (!value || value.length > 1000 || current?.readyState !== "open" || current.bufferedAmount > 64 * 1024 || Date.now() - lastSend.current < 250) return false;
    const id = crypto.randomUUID();
    try {
      current.send(JSON.stringify({ type: "message", id, text: value })); lastSend.current = Date.now();
      setMessages(rows => [...rows, { id, text: value, mine: true, delivered: false }].slice(-100)); return true;
    } catch { setPhase("error"); return false; }
  };
  return { messages, phase, send, reconnect: () => setGeneration(value => value + 1) };
}
