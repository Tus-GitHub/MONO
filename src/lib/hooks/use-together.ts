"use client";
import { useCallback, useRef, useState } from "react";
import { togetherFetch, errorMessage } from "@/lib/together/client";
import type { MessageDTO, TogetherSnapshot } from "@/lib/together/types";
import { useVisiblePoll } from "./use-visible-poll";
const merged = (old: MessageDTO[], next: MessageDTO[]) => !next.length ? old : [...new Map([...old, ...next].map((message) => [message.id, message])).values()].sort((a, b) => BigInt(a.sequence) < BigInt(b.sequence) ? -1 : 1);

export function useTogether(initial: TogetherSnapshot, chatVisible: boolean) {
  const [data, setData] = useState(initial), [error, setError] = useState<string | null>(null), [hasOlder, setHasOlder] = useState(initial.hasMore);
  const current = useRef({ cursor: initial.cursor, revision: initial.revision });
  const [delay, setDelay] = useState(2500);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const params = new URLSearchParams(current.current);
      params.set("after", current.current.cursor); params.delete("cursor");
      const next = await togetherFetch<TogetherSnapshot>(`/api/together?${params}`, { signal });
      if (signal?.aborted) return;
      const changed = next.revision !== current.current.revision || next.messages.length > 0;
      current.current = { cursor: next.cursor, revision: next.revision };
      setData((previous) => ({ ...previous, ...next, games: next.games ?? previous.games, scores: next.scores ?? previous.scores,
        imageBytes: next.imageBytes ?? previous.imageBytes, messages: merged(previous.messages, next.messages) }));
      setError(null); setDelay((old) => changed ? 2500 : Math.min(10_000, old + 1500));
    } catch (error) { if (!signal?.aborted) { setError(errorMessage(error)); setDelay(10_000); } }
  }, []);
  const observedAt = new Date(data.observedAt).getTime();
  const partnerOnline = Boolean(data.partner.lastSeenAt && observedAt - new Date(data.partner.lastSeenAt).getTime() < 45_000);
  const partnerTyping = Boolean(data.partner.typingUntil && new Date(data.partner.typingUntil).getTime() > observedAt);
  useVisiblePoll(refresh, partnerOnline || data.games?.some((game) => game.status === "ACTIVE") ? 2500 : delay);
  const append = useCallback((message: MessageDTO) => {
    setData((previous) => ({ ...previous, messages: merged(previous.messages, [message]) }));
    setDelay(2500);
  }, []);
  const typingRef = useRef(false);
  const onTyping = useCallback((value: boolean) => { typingRef.current = value; }, []);
  const lastPresence = useRef({ time: 0, sequence: "", typing: false });
  const markRead = useCallback(async (signal?: AbortSignal) => {
    if (!chatVisible || document.hidden) return;
    const last = lastPresence.current;
    if (last.sequence === current.current.cursor && !typingRef.current && !last.typing && Date.now() - last.time < 20_000) return;
    const presence = { sequence: current.current.cursor, typing: typingRef.current };
    await togetherFetch("/api/together/presence", { body: presence, signal });
    lastPresence.current = { time: Date.now(), ...presence };
  }, [chatVisible]);
  useVisiblePoll(markRead, 4000, chatVisible);
  const older = async () => {
    if (!data.messages[0]) return;
    try {
      const page = await togetherFetch<TogetherSnapshot>(`/api/together?before=${data.messages[0].sequence}`);
      setData((previous) => ({ ...previous, messages: merged(page.messages, previous.messages) })); setHasOlder(page.hasMore);
    } catch (error) { setError(errorMessage(error)); }
  };
  return { data, error, refresh, append, older, hasOlder, onTyping, partnerOnline, partnerTyping };
}
