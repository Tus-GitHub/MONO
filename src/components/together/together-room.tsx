"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Textarea } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Spinner } from "@/components/ui/spinner";
import { useTogether } from "@/lib/hooks/use-together";
import { togetherFetch, errorMessage } from "@/lib/together/client";
import { CHAT_IMAGE_SPACE, EMOJI, STICKERS } from "@/lib/together/catalog";
import type { MessageDTO, TogetherSnapshot } from "@/lib/together/types";
import { downscaleImage } from "@/lib/images/client-resize";
import { cn } from "@/lib/utils/cn";
import { useTogetherCall } from "./together-provider";
import { CallSetup } from "./call-setup";

const GamesPanel = dynamic(() => import("./games-panel"), { loading: () => <div className="flex justify-center py-10"><Spinner /></div> });
export function TogetherRoom({ initial, userId, userName }: { initial: TogetherSnapshot; userId: string; userName: string }) {
  const [tab, setTab] = useState<"chat" | "games" | "scores">("chat"), [selectedGame, setGame] = useState<string | null>(null);
  const chat = useTogether(initial, tab === "chat"), calling = useTogetherCall();
  const { partner } = chat.data;
  const callBusy = Boolean(calling.call) || calling.phase !== "idle";
  return <div className="mx-auto max-w-4xl space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="font-display text-3xl font-medium text-ink">Just us</h1>
      <p className="mt-1 text-sm text-muted">{partner.name} · {chat.partnerTyping ? "Typing…" : chat.partnerOnline ? "Online" : "Your private conversation and arcade"}</p></div>
      <div className="flex gap-2"><Button size="sm" variant="secondary" leadingIcon={<Icon name="phone" />} disabled={callBusy} onClick={() => void calling.start("AUDIO")}>Voice call</Button><Button size="sm" variant="secondary" leadingIcon={<Icon name="video" />} disabled={callBusy} onClick={() => void calling.start("VIDEO")}>Video call</Button></div></div>
    {!callBusy ? <div className="flex flex-wrap items-center gap-2"><CallSetup soundsReady={calling.soundsReady} enableSounds={calling.enableCallSounds} /><p className="text-xs text-muted">Prepare permissions, your ringtone and incoming-call notifications before calling.</p></div> : null}
    <div role="tablist" aria-label="Together" className="flex gap-2 border-b border-line pb-3">{([['chat', 'Chat'], ['games', 'Games · 24'], ['scores', 'Scores']] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} aria-controls={`together-${key}`} id={`tab-${key}`} onClick={() => setTab(key)} className={cn("rounded-lg px-4 py-2 text-sm font-medium", tab === key ? "bg-primary-tint text-primary" : "text-muted hover:bg-surface")}>{label}</button>)}</div>
    {chat.error ? <p role="alert" className="text-sm text-error">Live updates paused: {chat.error} <Button variant="link" onClick={() => void chat.refresh()}>Reconnect</Button></p> : null}
    {tab === "chat" ? <section role="tabpanel" id="together-chat" aria-labelledby="tab-chat" className="space-y-3">
      <MessageList messages={chat.data.messages} userId={userId} lastRead={partner.lastRead} timezone={chat.data.timezone} older={chat.older} hasOlder={chat.hasOlder}
        openGame={(id) => { setGame(id); setTab("games"); }} />
      <Composer append={chat.append} onTyping={chat.onTyping} imageBytes={chat.data.imageBytes ?? 0} />
      <p className="text-xs text-faint">Shared only in this space. Calls need microphone/camera permission and both partners online in MONO. Photos use {((chat.data.imageBytes ?? 0) / 1024 / 1024).toFixed(1)} of {CHAT_IMAGE_SPACE / 1024 / 1024} MB shared chat storage.</p>
    </section> : <section role="tabpanel" id={`together-${tab}`} aria-labelledby={`tab-${tab}`}>
      <GamesPanel games={chat.data.games ?? []} scores={chat.data.scores ?? []} userId={userId} userName={userName} partnerName={partner.name}
        selectedId={selectedGame} onSelect={setGame} refresh={chat.refresh} mode={tab} />
    </section>}
  </div>;
}
function MessageList({ messages, userId, lastRead, timezone, hasOlder, older, openGame }: {
  messages: MessageDTO[]; userId: string; lastRead: string; timezone: string; hasOlder: boolean; older: () => Promise<void>; openGame: (id: string) => void;
}) {
  const scroll = useRef<HTMLDivElement | null>(null), atBottom = useRef(true), first = useRef(true), [loading, setLoading] = useState(false);
  const last = messages[messages.length - 1];
  useEffect(() => {
    const list = scroll.current;
    if (list && (first.current || atBottom.current || last?.senderId === userId)) { list.scrollTo({ top: list.scrollHeight, behavior: first.current ? "auto" : "smooth" }); first.current = false; }
  }, [last?.id, last?.senderId, userId]);
  const loadOlder = async () => {
    const element = scroll.current, height = element?.scrollHeight ?? 0, top = element?.scrollTop ?? 0;
    setLoading(true); await older(); setLoading(false);
    requestAnimationFrame(() => { if (element) element.scrollTop = top + element.scrollHeight - height; });
  };
  const day = (value: string) => new Intl.DateTimeFormat("en-GB", { timeZone: timezone, day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
  const time = (value: string) => new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  return <div ref={scroll} className="h-[clamp(18rem,50dvh,36rem)] overflow-y-auto rounded-2xl border border-line bg-surface/60 p-3 sm:p-5" onScroll={() => { const el = scroll.current; if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }}>
    {hasOlder ? <div className="mb-4 text-center"><Button variant="ghost" size="sm" loading={loading} onClick={() => void loadOlder()}>Load earlier messages</Button></div> : null}
    {!messages.length ? <div className="grid h-full place-content-center text-center"><p className="font-display text-xl">A little space for the two of you</p><p className="mt-2 text-sm text-muted">Say hello, share a photo, or invite your partner to a game.</p></div> : null}
    <div role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions" className="space-y-3">{messages.map((message, index) => {
      const mine = message.senderId === userId, sticker = message.kind === "STICKER" ? STICKERS.find((item) => item.id === message.body) : null;
      return <div key={message.id}>
        {index === 0 || day(messages[index - 1].createdAt) !== day(message.createdAt) ? <p className="my-5 text-center text-2xs text-faint">{day(message.createdAt)}</p> : null}
        <article aria-label={`${mine ? "You" : "Partner"} ${time(message.createdAt)}`} className={cn("max-w-[85%] space-y-2 rounded-2xl px-4 py-3 sm:max-w-[75%]", mine ? "ml-auto bg-primary-tint text-ink" : "mr-auto border border-line bg-surface text-ink")}>
          {message.image ? <a href={message.image.url} target="_blank" rel="noreferrer"><Image unoptimized src={message.image.url} alt="Shared chat image" width={message.image.width} height={message.image.height} className="max-h-80 w-auto max-w-full rounded-xl object-contain" /></a>
            : sticker ? <div className="py-2 text-center"><span role="img" aria-label={sticker.label} className="block text-6xl">{sticker.emoji}</span><p className="mt-2 font-display text-lg">{sticker.label}</p></div>
            : <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{message.body}</p>}
          {message.kind === "GAME" && message.gameId ? <Button variant="secondary" size="sm" onClick={() => openGame(message.gameId!)}>Open game</Button> : null}
          <p className="text-right text-2xs text-muted">{time(message.createdAt)}{mine ? ` · ${BigInt(lastRead) >= BigInt(message.sequence) ? "Read" : "Sent"}` : ""}</p>
        </article>
      </div>;
    })}</div>
  </div>;
}
function Composer({ append, onTyping, imageBytes }: { append: (message: MessageDTO) => void; onTyping: (value: boolean) => void; imageBytes: number }) {
  const [text, setText] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [palette, setPalette] = useState<"emoji" | "stickers" | null>(null), [picture, setPicture] = useState<File | null>(null);
  const file = useRef<HTMLInputElement | null>(null), nonce = useRef({ identity: "", value: "" }), imageNonce = useRef("");
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { clearTimeout(typingTimer.current); onTyping(false); }, [onTyping]);
  const edit = (value: string) => { setText(value); onTyping(Boolean(value)); clearTimeout(typingTimer.current); typingTimer.current = setTimeout(() => onTyping(false), 4000); };
  const send = async (kind: "TEXT" | "STICKER", body: string) => {
    if (busy || !body.trim()) return;
    const identity = `${kind}:${body}`;
    if (nonce.current.identity !== identity) nonce.current = { identity, value: crypto.randomUUID() };
    setBusy(true); setError(null);
    try { const message = await togetherFetch<MessageDTO>("/api/together", { body: { kind, body, clientNonce: nonce.current.value } }); append(message); if (kind === "TEXT") { setText(""); onTyping(false); } nonce.current = { identity: "", value: "" }; setPalette(null); }
    catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  };
  const sendImage = async () => {
    if (busy || !picture) return;
    setBusy(true); setError(null);
    try {
      imageNonce.current ||= crypto.randomUUID();
      const form = new FormData(); form.set("file", await downscaleImage(picture));
      const message = await togetherFetch<MessageDTO>(`/api/together/images?nonce=${imageNonce.current}`, { body: form });
      append(message); setPicture(null); imageNonce.current = "";
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  };
  return <div className="space-y-3">
    {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
    {picture ? <div className="space-y-3 rounded-xl border border-line bg-surface p-3"><PhotoPreview file={picture} /><p className="truncate text-xs text-muted">{picture.name}</p><div className="flex gap-2"><Button size="sm" loading={busy} onClick={() => void sendImage()}>Send image</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => { setPicture(null); imageNonce.current = ""; }}>Cancel image</Button></div></div> : null}
    <form onSubmit={(event) => { event.preventDefault(); void send("TEXT", text.trim()); }} className="space-y-2 rounded-2xl border border-line bg-surface p-3">
      <Textarea aria-label="Message your partner" placeholder="Message your partner…" maxLength={4000} rows={2} value={text} disabled={busy} onChange={(event) => edit(event.target.value)} />
      <div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="ghost" disabled={busy} onClick={() => setPalette("emoji")}>Emoji</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => setPalette("stickers")}>Stickers</Button>
        <Button size="sm" variant="ghost" disabled={busy || imageBytes >= CHAT_IMAGE_SPACE} onClick={() => file.current?.click()}>Photo</Button>
        <input ref={file} type="file" accept="image/*" aria-label="Choose a chat image" className="sr-only" tabIndex={-1} onChange={(event) => { const next = event.target.files?.[0]; if (next) { setPicture(next); imageNonce.current = ""; } event.target.value = ""; }} />
        <Button className="ml-auto" size="sm" type="submit" loading={busy} disabled={!text.trim() || busy}>Send</Button>
      </div>
    </form>
    <BottomSheet open={palette != null} onClose={() => setPalette(null)} title={palette === "emoji" ? "Say it with an emoji" : "A little something for them"}>
      {palette === "emoji" ? <div className="grid grid-cols-6 gap-2">{EMOJI.map((emoji) => <button key={emoji} type="button" aria-label={`Insert ${emoji}`} disabled={text.length + emoji.length > 4000} className="aspect-square rounded-xl bg-surface text-3xl disabled:opacity-40" onClick={() => { edit(text + emoji); setPalette(null); }}>{emoji}</button>)}</div>
        : <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{STICKERS.map((sticker) => <button key={sticker.id} type="button" disabled={busy} aria-label={`Send ${sticker.label} sticker`} onClick={() => void send("STICKER", sticker.id)} className={cn("rounded-xl border border-line p-4 text-center", sticker.background)}><span className="text-5xl">{sticker.emoji}</span><span className="mt-3 block text-sm font-medium">{sticker.label}</span></button>)}</div>}
    </BottomSheet>
  </div>;
}
function PhotoPreview({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => { const preview = URL.createObjectURL(file); let live = true; queueMicrotask(() => { if (live) setUrl(preview); }); return () => { live = false; URL.revokeObjectURL(preview); }; }, [file]);
  return url ? <Image unoptimized src={url} alt="Image ready to share" width={400} height={300} className="max-h-48 w-auto rounded-lg object-contain" /> : null;
}
