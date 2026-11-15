"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Textarea } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Spinner } from "@/components/ui/spinner";
import { ImageCropDialog } from "@/components/uploads/image-crop-dialog";
import { useTogether } from "@/lib/hooks/use-together";
import { togetherFetch, errorMessage } from "@/lib/together/client";
import { CHAT_IMAGE_SPACE, EMOJI, STICKERS } from "@/lib/together/catalog";
import type { MessageDTO, TogetherSnapshot } from "@/lib/together/types";
import { chatAAD, encryptText, type ChatKey } from "@/lib/together/chat-crypto";
import { encryptPhoto } from "@/lib/together/secure-photo";
import { DOCUMENT_ACCEPT, DOCUMENT_LIMIT, encryptDocument } from "@/lib/together/attachments";
import { ChatEncryption, SecureHistory } from "./chat-encryption";
import { SecureMessage } from "./secure-message";
import { cn } from "@/lib/utils/cn";
import { useTogetherCall } from "./together-provider";
import { MusicControls } from "@/components/settings/background-music";
import { CallSetup } from "./call-setup";

const GamesPanel = dynamic(() => import("./games-panel"), { loading: () => <div className="flex justify-center py-10"><Spinner /></div> });
export function TogetherRoom({ initial, userId, userName }: { initial: TogetherSnapshot; userId: string; userName: string }) {
  const [tab, setTab] = useState<"chat" | "games" | "scores">("chat"), [selectedGame, setGame] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState<ChatKey | null>(null);
  const [soundsOpen, setSoundsOpen] = useState(false);
  const chat = useTogether(initial, tab === "chat" && chatKey != null), calling = useTogetherCall();
  const { partner } = chat.data;
  const callBusy = Boolean(calling.call) || calling.phase !== "idle";
  return <div className="flex h-full min-h-0 w-full flex-col">
    <header className="mono-chat-header flex shrink-0 items-center gap-2 border-b border-line bg-elevated px-2 py-2 sm:gap-3 sm:px-5">
      <Link href="/home" aria-label="Back to MONO" className="tap grid shrink-0 place-items-center rounded-lg text-muted hover:bg-surface"><Icon name="arrowLeft" /></Link>
      <span aria-hidden="true" className="relative grid size-9 shrink-0 place-items-center rounded-full bg-primary-tint font-display text-lg text-primary">{partner.name.slice(0, 1)}{chat.partnerOnline ? <span className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-elevated bg-success" /> : null}</span>
      <div className="min-w-0 flex-1"><h1 className="truncate font-display text-xl font-medium text-ink">{partner.name}</h1>
        <p className="mono-chat-presence truncate text-xs text-muted">{chat.partnerTyping ? "Typing…" : chat.partnerOnline ? "Online" : "Just us · private chat"}</p></div>
      <div className="flex shrink-0 items-center gap-1"><Button size="icon" variant="ghost" aria-label="Voice call" title="Voice call" disabled={callBusy} onClick={() => void calling.start("AUDIO")}><Icon name="phone" /></Button><Button size="icon" variant="ghost" aria-label="Video call" title="Video call" disabled={callBusy} onClick={() => void calling.start("VIDEO")}><Icon name="video" /></Button>
        {!callBusy ? <Button variant="ghost" size="icon" aria-label="Chat sound settings" onClick={() => setSoundsOpen(true)}><Icon name="settings" /></Button> : null}</div>
    </header>
    <BottomSheet open={soundsOpen} onClose={() => setSoundsOpen(false)} title="Sounds & notifications"><div className="space-y-5"><CallSetup soundsReady={calling.soundsReady} enableSounds={calling.enableCallSounds} /><MusicControls /><Link href="/settings/profile" className="text-sm text-primary underline">Change your ringtone in your profile</Link></div></BottomSheet>
    <div role="tablist" aria-label="Together" className="mono-chat-tabs flex shrink-0 gap-1 border-b border-line px-3 py-1 sm:px-5">{([['chat', 'Chat'], ['games', 'Games · 24'], ['scores', 'Scores']] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} aria-controls={`together-${key}`} id={`tab-${key}`} onClick={() => setTab(key)} className={cn("min-h-9 rounded-lg px-3 py-1 text-sm font-medium", tab === key ? "bg-primary-tint text-primary" : "text-muted hover:bg-surface")}>{label}</button>)}</div>
    {chat.error ? <p role="alert" className="shrink-0 px-3 py-1 text-sm text-error">Live updates paused: {chat.error} <Button variant="link" onClick={() => void chat.refresh()}>Reconnect</Button></p> : null}
    {tab === "chat" ? <section role="tabpanel" id="together-chat" aria-labelledby="tab-chat" className="flex min-h-0 flex-1 flex-col">
      {!chatKey ? <div className="min-h-0 flex-1 overflow-y-auto"><ChatEncryption coupleId={chat.data.coupleId} userId={userId} keyId={chat.data.chatKeyId} onUnlock={setChatKey} refresh={chat.refresh} /></div> : <>
      <SecureHistory chatKey={chatKey} coupleId={chat.data.coupleId} refresh={chat.refresh} />
      <MessageList chatKey={chatKey} coupleId={chat.data.coupleId} append={chat.append} messages={chat.data.messages.filter((message) => !message.hidden)} userId={userId} lastRead={partner.lastRead} timezone={chat.data.timezone} older={chat.older} hasOlder={chat.hasOlder}
        openGame={(id) => { setGame(id); setTab("games"); }} />
      <Composer chatKey={chatKey} coupleId={chat.data.coupleId} userId={userId} append={chat.append} onTyping={chat.onTyping} imageBytes={chat.data.imageBytes ?? 0} />
      </>}
    </section> : <section role="tabpanel" id={`together-${tab}`} aria-labelledby={`tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6">
      <GamesPanel games={chat.data.games ?? []} scores={chat.data.scores ?? []} userId={userId} userName={userName} partnerName={partner.name}
        selectedId={selectedGame} onSelect={setGame} refresh={chat.refresh} mode={tab} />
    </section>}
  </div>;
}
function MessageList({ chatKey, coupleId, append, messages, userId, lastRead, timezone, hasOlder, older, openGame }: {
  chatKey: ChatKey; coupleId: string; append: (row: MessageDTO) => void; messages: MessageDTO[]; userId: string; lastRead: string; timezone: string; hasOlder: boolean; older: () => Promise<void>; openGame: (id: string) => void;
}) {
  const scroll = useRef<HTMLDivElement | null>(null), content = useRef<HTMLDivElement | null>(null), atBottom = useRef(true), lastScrollTop = useRef(0), first = useRef(true), [loading, setLoading] = useState(false);
  const last = messages[messages.length - 1];
  useLayoutEffect(() => {
    const list = scroll.current;
    if (list && (first.current || atBottom.current || last?.senderId === userId)) {
      atBottom.current = true;
      list.scrollTop = list.scrollHeight;
      lastScrollTop.current = list.scrollTop;
      first.current = false;
    }
  }, [last?.id, last?.senderId, userId]);
  useEffect(() => {
    const list = scroll.current;
    if (!list) return;
    const resize = new ResizeObserver(() => {
      if (atBottom.current) { list.scrollTop = list.scrollHeight; lastScrollTop.current = list.scrollTop; }
    });
    resize.observe(list);
    // Decryption and photo loading can grow bubbles without resizing the scrollport.
    if (content.current) resize.observe(content.current);
    return () => resize.disconnect();
  }, []);
  const loadOlder = async () => {
    const element = scroll.current, height = element?.scrollHeight ?? 0, top = element?.scrollTop ?? 0;
    setLoading(true); await older(); setLoading(false);
    requestAnimationFrame(() => { if (element) element.scrollTop = top + element.scrollHeight - height; });
  };
  const day = (value: string) => new Intl.DateTimeFormat("en-GB", { timeZone: timezone, day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
  const time = (value: string) => new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  return <div ref={scroll} className="mono-chat-messages mono-conversation min-h-0 flex-1 overflow-y-auto overscroll-contain [overflow-anchor:none] bg-paper px-3 py-2 sm:px-6" onScroll={() => {
    const el = scroll.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    // A queued scroll event can arrive after bubbles decrypt and grow. Only an
    // upward move leaves the pinned position; content growth is not reader intent.
    if (nearBottom || el.scrollTop < lastScrollTop.current) atBottom.current = nearBottom;
    lastScrollTop.current = el.scrollTop;
  }}>
    <p className="mx-auto mb-3 w-fit rounded-full border border-line bg-paper px-3 py-1 text-center text-2xs text-muted">Only you two · Hold a message for options</p>
    {hasOlder ? <div className="mb-4 text-center"><Button variant="ghost" size="sm" loading={loading} onClick={() => void loadOlder()}>Load earlier messages</Button></div> : null}
    {!messages.length ? <div className="grid h-full place-content-center text-center"><p className="font-display text-xl">A little space for the two of you</p><p className="mt-2 text-sm text-muted">Say hello, share a photo, or invite your partner to a game.</p></div> : null}
    <div ref={content} role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions" className="space-y-1">{messages.map((message, index) => {
      const mine = message.senderId === userId;
      return <div key={message.id}>
        {index === 0 || day(messages[index - 1].createdAt) !== day(message.createdAt) ? <p className="my-3 text-center text-2xs text-faint">{day(message.createdAt)}</p> : null}
        <article aria-label={`${mine ? "You" : "Partner"} ${time(message.createdAt)}`} className={cn("w-fit max-w-[85%] space-y-0.5 rounded-2xl px-3 py-1.5 sm:max-w-[65%]", mine ? "ml-auto rounded-br-sm bg-primary-tint text-ink" : "mr-auto rounded-bl-sm border border-line bg-surface text-ink")}>
          <SecureMessage message={message} chatKey={chatKey} coupleId={coupleId} mine={mine} append={append} />
          {message.kind === "GAME" && message.gameId ? <Button variant="secondary" size="sm" onClick={() => openGame(message.gameId!)}>Open game</Button> : null}
          <p className="text-right text-2xs text-muted">{time(message.createdAt)}{mine ? ` · ${BigInt(lastRead) >= BigInt(message.sequence) ? "Read" : "Sent"}` : ""}</p>
        </article>
      </div>;
    })}</div>
  </div>;
}
function Composer({ chatKey, coupleId, userId, append, onTyping, imageBytes }: { chatKey: ChatKey; coupleId: string; userId: string; append: (message: MessageDTO) => void; onTyping: (value: boolean) => void; imageBytes: number }) {
  const [text, setText] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [failedText, setFailedText] = useState<{ body: string; clientNonce: string } | null>(null);
  const [palette, setPalette] = useState<"emoji" | "stickers" | null>(null), [picture, setPicture] = useState<File | null>(null);
  const [viewLimit, setViewLimit] = useState<0 | 1 | 2>(0);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [cropFiles, setCropFiles] = useState<File[] | null>(null);
  const input = useRef<HTMLTextAreaElement | null>(null), composer = useRef<HTMLDivElement | null>(null);
  const sending = useRef(false), draftVersion = useRef(0);
  const [pendingDocument, setDocument] = useState<File | null>(null);
  const documentFile = useRef<HTMLInputElement | null>(null), documentNonce = useRef("");
  const file = useRef<HTMLInputElement | null>(null), nonce = useRef({ identity: "", value: "" }), imageNonce = useRef("");
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useLayoutEffect(() => {
    const field = input.current, host = composer.current;
    if (!field || !host) return;
    const focused = document.activeElement === field;
    const atEnd = field.selectionStart === field.value.length && field.selectionEnd === field.value.length;
    const previousScroll = field.scrollTop;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
    // WebKit can reset the textarea's own scroll while sizing it. Keep the caret
    // visible at the end, and preserve the reader's position when editing earlier text.
    field.scrollTop = focused && atEnd ? field.scrollHeight : previousScroll;
    if (!focused) return;
    const rect = field.getBoundingClientRect(), bounds = host.getBoundingClientRect(), style = getComputedStyle(host);
    const top = bounds.top + parseFloat(style.paddingTop), bottom = bounds.bottom - parseFloat(style.paddingBottom);
    // Error/retry controls can grow above the field. Reveal it only inside this
    // scrollport; never refocus it asynchronously or scroll the page/chat shell.
    if (rect.bottom > bottom) host.scrollTop += rect.bottom - bottom;
    else if (rect.top < top) host.scrollTop += rect.top - top;
  }, [text, error, failedText]);
  useEffect(() => () => { clearTimeout(typingTimer.current); onTyping(false); }, [onTyping]);
  const edit = (value: string) => { draftVersion.current++; setText(value); onTyping(Boolean(value)); clearTimeout(typingTimer.current); if (value) typingTimer.current = setTimeout(() => onTyping(false), 4000); };
  const keepComposerFocus = (event: PointerEvent<HTMLElement>) => {
    // Keep the existing keyboard session; asynchronous focus() cannot reliably reopen it on iOS.
    if (event.isPrimary && event.button === 0 && document.activeElement === input.current) event.preventDefault();
  };
  const send = async (kind: "TEXT" | "STICKER", body: string, retry?: NonNullable<typeof failedText>) => {
    if (sending.current || !body.trim() || (failedText && !retry)) return;
    const identity = `${kind}:${body}`;
    if (!retry && nonce.current.identity !== identity) nonce.current = { identity, value: crypto.randomUUID() };
    const clientNonce = retry?.clientNonce ?? nonce.current.value;
    const submittedDraft = text;
    sending.current = true;
    setBusy(true); setError(null);
    if (kind === "TEXT" && !retry) edit("");
    const clearedVersion = draftVersion.current;
    try {
      const message = await togetherFetch<MessageDTO>("/api/together", { body: { kind, body: await encryptText(chatKey, body, chatAAD(coupleId, userId, clientNonce, kind)), clientNonce } });
      append(message); setFailedText(null); nonce.current = { identity: "", value: "" }; setPalette(null);
    } catch (error) {
      setError(errorMessage(error));
      if (kind === "TEXT" && !retry) {
        if (draftVersion.current === clearedVersion) edit(submittedDraft);
        else setFailedText({ body, clientNonce });
      }
    } finally { sending.current = false; setBusy(false); }
  };
  const sendImage = async () => {
    if (sending.current || failedText || !picture) return;
    sending.current = true;
    setBusy(true); setError(null);
    try {
      imageNonce.current ||= crypto.randomUUID();
      const payload = await encryptPhoto(picture, chatKey, coupleId, userId, imageNonce.current, viewLimit);
      const message = await togetherFetch<MessageDTO>("/api/together/images", { body: payload });
      append(message); setPicture(null); imageNonce.current = "";
    } catch (error) { setError(errorMessage(error)); }
    finally { sending.current = false; setBusy(false); }
  };
  const sendDocument = async () => {
    if (sending.current || failedText || !pendingDocument) return;
    sending.current = true;
    setBusy(true); setError(null);
    try {
      documentNonce.current ||= crypto.randomUUID();
      const payload = await encryptDocument(pendingDocument, chatKey, coupleId, userId, documentNonce.current);
      append(await togetherFetch<MessageDTO>("/api/together/documents", { body: payload }));
      setDocument(null); documentNonce.current = ""; setToolsOpen(false);
    } catch (error) { setError(errorMessage(error)); } finally { sending.current = false; setBusy(false); }
  };
  return <div ref={composer} className="mono-chat-composer min-h-0 shrink-0 space-y-2 overflow-y-auto overscroll-contain border-t border-line bg-elevated px-2 py-2 sm:px-5">
    {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
    {failedText ? <div className="space-y-1 text-sm">
      <p className="text-muted">Your previous send wasn’t confirmed. Your new draft is kept below.</p>
      <p className="line-clamp-2 text-ink">{failedText.body}</p>
      <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy} onPointerDown={keepComposerFocus} onClick={() => void send("TEXT", failedText.body, failedText)}>Retry message</Button>
        <Button size="sm" variant="ghost" disabled={busy} onPointerDown={keepComposerFocus} onClick={() => { setFailedText(null); setError(null); }}>Dismiss retry</Button></div>
    </div> : null}
    <BottomSheet open={pendingDocument != null} title="Share a document" onClose={() => { if (!busy) { setDocument(null); documentNonce.current = ""; } }} footer={<Button loading={busy} onClick={() => void sendDocument()}>Send document</Button>}>
      <div className="flex items-center gap-3"><Icon name="document" /><p className="break-all">{pendingDocument?.name}</p></div><p className="mt-3 text-sm text-muted">End-to-end encrypted · up to 2 MB. Your partner can save a copy.</p>{error ? <p role="alert" className="mt-2 text-sm text-error">{error}</p> : null}
    </BottomSheet>
    <BottomSheet open={picture != null} onClose={() => { if (!busy) { setPicture(null); imageNonce.current = ""; } }} title="Share a photo"
      footer={<div className="flex gap-2"><Button size="sm" loading={busy} onClick={() => void sendImage()}>Send image</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => { setPicture(null); imageNonce.current = ""; }}>Cancel image</Button></div>}>
      <label className="block space-y-2 text-sm">Photo access<select aria-label="Photo access" disabled={busy} value={viewLimit} onChange={(event) => { setViewLimit(Number(event.target.value) as 0 | 1 | 2); imageNonce.current = ""; }} className="block w-full rounded-lg border border-line bg-surface p-3"><option value={0}>Keep in chat</option><option value={1}>View once</option><option value={2}>View twice</option></select></label>
      {viewLimit > 0 ? <p className="my-2 text-xs text-muted">Your partner can open this photo {viewLimit === 1 ? "once" : "twice"}. MONO cannot block screenshots or recordings, or warn you about them.</p> : null}
      {picture ? <div className="space-y-2"><PhotoPreview file={picture} /><p className="truncate text-xs text-muted">{picture.name}</p>{error ? <p role="alert" className="text-sm text-error">{error}</p> : null}</div> : null}
    </BottomSheet>
    <form onSubmit={(event) => { event.preventDefault(); void send("TEXT", text.trim()); }} className="space-y-1">
      {toolsOpen ? <div className="flex flex-wrap items-center gap-1"><Button size="sm" variant="ghost" disabled={busy || !!failedText} onClick={() => setPalette("emoji")}><Icon name="smile" size="sm" />Emoji</Button><Button size="sm" variant="ghost" disabled={busy || !!failedText} onClick={() => setPalette("stickers")}><Icon name="heart" size="sm" />Stickers</Button>
        <Button size="sm" variant="ghost" disabled={busy || !!failedText || imageBytes >= CHAT_IMAGE_SPACE} onClick={() => file.current?.click()}><Icon name="images" size="sm" />Photo</Button>
        <Button size="sm" variant="ghost" disabled={busy || !!failedText || imageBytes >= CHAT_IMAGE_SPACE} onClick={() => documentFile.current?.click()}><Icon name="document" size="sm" />Document</Button>
        <span className="ml-auto text-2xs text-faint">{(imageBytes / 1024 / 1024).toFixed(1)} / {CHAT_IMAGE_SPACE / 1024 / 1024} MB</span>
      </div> : null}
        <input ref={file} type="file" accept="image/*" aria-label="Choose a chat image" className="sr-only" tabIndex={-1} onChange={(event) => { const next = event.target.files?.[0]; if (next && !busy && !cropFiles) setCropFiles([next]); event.target.value = ""; }} />
      <input ref={documentFile} type="file" accept={DOCUMENT_ACCEPT} aria-label="Choose a chat document" className="sr-only" tabIndex={-1} onChange={(event) => { const next = event.target.files?.[0]; event.target.value = ""; if (!next || sending.current || failedText) return; if (!next.size || next.size > DOCUMENT_LIMIT) { setError("Choose a document up to 2 MB."); return; } documentNonce.current = ""; setError(null); setDocument(next); }} />
      <div className="flex items-end gap-2">
        <Button size="icon" variant="ghost" aria-label={toolsOpen ? "Hide message tools" : "Emoji, stickers, photos and documents"} aria-expanded={toolsOpen} onClick={() => setToolsOpen(!toolsOpen)} className="shrink-0"><Icon name={toolsOpen ? "x" : "plus"} /></Button>
        <Textarea ref={input} aria-label="Message your partner" placeholder="Message…" className="mono-chat-input min-h-11 flex-1" maxLength={4000} rows={1} value={text} onChange={(event) => edit(event.target.value)} />
        <span className="inline-flex shrink-0 touch-manipulation" onPointerDown={keepComposerFocus}>
          <Button size="icon" aria-label="Send message" type="submit" loading={busy} disabled={!text.trim() || busy || !!failedText}><Icon name="arrowRight" /></Button>
        </span>
      </div>
    </form>
    {cropFiles ? <ImageCropDialog files={cropFiles} onCancel={() => setCropFiles(null)}
      onConfirm={([cropped]) => { setCropFiles(null); setPicture(cropped); imageNonce.current = ""; }} /> : null}
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
