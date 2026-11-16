"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { EMOJI_OPTIONS, STICKERS } from "@/lib/together/catalog";
import { togetherFetch, errorMessage } from "@/lib/together/client";
import type { ChatKey } from "@/lib/together/chat-crypto";
import { prepareSticker } from "@/lib/together/prepare-sticker";
import { readStickerPixels, stickerLibrary, type LibrarySticker, type PreparedSticker } from "@/lib/together/stickers";
import type { MessageDTO } from "@/lib/together/types";
import { TaskScope } from "@/lib/state/task";
import { cn } from "@/lib/utils/cn";
import { StickerImage } from "./sticker-image";

export function ChatExpressionPicker({ open, tab, onTab, onClose, onEmoji, onSticker, onCustom, chatKey, coupleId, revision, busy, emojiSpace }: {
  open: boolean; tab: "emoji" | "stickers"; onTab: (tab: "emoji" | "stickers") => void; onClose: () => void;
  onEmoji: (emoji: string) => void; onSticker: (id: string) => Promise<boolean>; onCustom: (sticker: PreparedSticker, name: string) => Promise<void>;
  chatKey: ChatKey; coupleId: string; revision: string; busy: boolean; emojiSpace: number;
}) {
  const pickerId = useId(), imageInput = useRef<HTMLInputElement | null>(null);
  const operation = useRef(new TaskScope());
  const [query, setQuery] = useState(""), [library, setLibrary] = useState<LibrarySticker[]>([]);
  const [loading, setLoading] = useState(false), [preparing, setPreparing] = useState(false), [reusing, setReusing] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<PreparedSticker | null>(null), [name, setName] = useState("");
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [reload, setReload] = useState(0);
  const working = busy || preparing || reusing != null;
  useEffect(() => {
    if (!open || tab !== "stickers") return;
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) setLoading(true); });
    togetherFetch<{ stickers: MessageDTO[] }>("/api/together/stickers", { signal: controller.signal })
      .then(({ stickers }) => stickerLibrary(stickers, chatKey, coupleId))
      .then((items) => { if (!controller.signal.aborted) setLibrary(items); })
      .catch(() => { if (!controller.signal.aborted) setError("Couldn't load your stickers. Try again."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, tab, chatKey, coupleId, revision, reload]);
  useEffect(() => {
    const scope = operation.current;
    if (!open) {
      scope.cancel();
      let live = true;
      queueMicrotask(() => { if (live) { setCandidate(null); setName(""); setQuery(""); setError(""); setNotice(""); setPreparing(false); setReusing(null); } });
      return () => { live = false; };
    }
    return () => scope.cancel();
  }, [open]);
  useEffect(() => () => { candidate?.bytes.fill(0); }, [candidate]);

  const choose = async (file: File) => {
    const scope = operation.current, signal = scope.begin();
    if (!signal) return;
    setPreparing(true); setError(""); setNotice("");
    try {
      const next = await prepareSticker(file);
      if (!scope.owns(signal)) { next.bytes.fill(0); return; }
      setCandidate(next); setName("");
    } catch (failure) { if (scope.owns(signal)) setError(errorMessage(failure)); }
    finally { if (scope.finish(signal)) setPreparing(false); }
  };
  const sendCandidate = async () => {
    if (!candidate || !name.trim() || working) return;
    setError(""); setNotice("");
    try {
      await onCustom(candidate, name.trim()); setCandidate(null); setName(""); setNotice("Sticker sent and saved to Our stickers."); setReload((value) => value + 1);
    } catch (failure) { setError(errorMessage(failure)); }
  };
  const reuse = async (item: LibrarySticker) => {
    if (working) return;
    const scope = operation.current, signal = scope.begin();
    if (!signal) return;
    setReusing(item.message.id); setError(""); setNotice("");
    let bytes: Uint8Array | undefined;
    try {
      bytes = await readStickerPixels(item.message, chatKey, coupleId, signal);
      signal.throwIfAborted();
      await onCustom({ id: item.metadata.id, bytes, width: item.message.image!.width, height: item.message.image!.height }, item.metadata.name);
      if (scope.owns(signal)) { setNotice("Sticker sent."); setReload((value) => value + 1); }
    } catch (failure) { if (scope.owns(signal)) setError(errorMessage(failure)); }
    finally { bytes?.fill(0); if (scope.finish(signal)) setReusing(null); }
  };
  const term = query.trim().toLocaleLowerCase();
  const emoji = EMOJI_OPTIONS.filter(([value, keywords]) => !term || keywords.includes(term) || value.includes(term));
  const personal = library.filter((item) => item.metadata.name.toLocaleLowerCase().includes(term));
  const originals = STICKERS.filter((item) => !term || item.label.toLocaleLowerCase().includes(term) || item.emoji.includes(term));
  const changeTab = (value: "emoji" | "stickers") => { setQuery(""); setError(""); setNotice(""); onTab(value); };

  return <BottomSheet open={open} onClose={() => { if (!busy) onClose(); }} title="Emoji & stickers" description="A little more you. Just for the two of you."
    footer={<div className="flex items-center justify-between gap-3">
      {candidate ? <Button loading={busy} disabled={!name.trim() || working} onClick={() => void sendCandidate()}>Send & save sticker</Button> : <p className="text-xs text-muted">{tab === "emoji" ? "Tap to add to your message" : "Tap a sticker to send"}</p>}
      <Button variant="ghost" disabled={busy} onClick={onClose}>Done</Button>
    </div>}>
    <div className="space-y-4">
      <div role="tablist" aria-label="Expression type" className="flex gap-1 rounded-xl bg-paper p-1">
        {(["emoji", "stickers"] as const).map((value) => <button key={value} type="button" role="tab" id={`${pickerId}-${value}-tab`} aria-selected={tab === value} aria-controls={`${pickerId}-${value}`} disabled={working || candidate != null}
          className={cn("min-h-11 flex-1 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === value ? "bg-elevated text-primary shadow-sm" : "text-muted hover:text-ink")}
          onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? "emoji" : event.key === "End" ? "stickers" : value === "emoji" ? "stickers" : "emoji"; changeTab(next); document.getElementById(`${pickerId}-${next}-tab`)?.focus(); } }}
          tabIndex={tab === value ? 0 : -1} onClick={() => changeTab(value)}>{value === "emoji" ? "Emoji" : "Stickers"}</button>)}
      </div>
      {error ? <p role="alert" className="text-sm text-error">{error} {!candidate ? <button type="button" className="underline" onClick={() => { setError(""); setReload((value) => value + 1); }}>Retry</button> : null}</p> : null}
      {notice ? <p role="status" className="text-sm text-success">{notice}</p> : null}
      <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Choose a custom sticker image" tabIndex={-1} className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file && !working) void choose(file); }} />
      {candidate ? <div className="space-y-4">
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setCandidate(null); setError(""); }}><Icon name="arrowLeft" size="sm" /> Back to stickers</Button>
        <CandidatePreview sticker={candidate} />
        <label className="block space-y-2 text-sm font-medium" htmlFor={`${pickerId}-name`}>Sticker name<Input id={`${pickerId}-name`} value={name} maxLength={40} disabled={busy} placeholder="Our happy dance" onChange={(event) => setName(event.target.value)} /></label>
        <p className="text-xs text-muted">Send it once to keep it in Our stickers. Use a transparent PNG for a cut-out look.</p>
      </div> : <div role="tabpanel" id={`${pickerId}-${tab}`} aria-labelledby={`${pickerId}-${tab}-tab`} className="space-y-4">
        <div className="relative"><Icon name="search" size="sm" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" /><Input aria-label={tab === "emoji" ? "Search emoji" : "Search stickers"} placeholder={tab === "emoji" ? "Find an emoji…" : "Find a sticker…"} className="pl-10" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <div className="max-h-72 space-y-5 overflow-y-auto overscroll-contain pr-1">
          {tab === "emoji" ? emoji.length ? <div className="grid grid-cols-6 gap-2">{emoji.map(([value, keywords]) => <button key={value} type="button" aria-label={`Insert ${value} (${keywords})`} disabled={value.length > emojiSpace} className="grid min-h-12 place-items-center rounded-xl text-3xl transition-colors hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40" onClick={() => onEmoji(value)}>{value}</button>)}</div>
            : <p className="py-6 text-center text-sm text-muted">No emoji found. Try “love”, “hug” or “happy”.</p>
            : <>
              <section aria-label="Our stickers" className="space-y-3">
                <div className="flex items-center justify-between gap-2"><div><h3 className="font-medium text-ink">Our stickers</h3><p className="text-2xs text-muted">Your recently shared creations</p></div><Button size="sm" variant="secondary" disabled={working} loading={preparing} onClick={() => imageInput.current?.click()}><Icon name="plus" size="sm" />Create</Button></div>
                {loading && !library.length ? <p role="status" className="py-4 text-center text-sm text-muted">Loading your stickers…</p> : personal.length ? <div className="grid grid-cols-4 gap-2">{personal.map((item) => <button key={item.metadata.id} type="button" disabled={working} title={item.metadata.name} aria-label={`Send ${item.metadata.name} custom sticker`} className="rounded-xl p-1 transition-colors hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" onClick={() => void reuse(item)}><StickerImage message={item.message} chatKey={chatKey} coupleId={coupleId} label={item.metadata.name} className="w-full" /><span className="mt-1 block truncate text-2xs text-muted">{item.metadata.name}</span></button>)}</div>
                  : <button type="button" disabled={working} onClick={() => imageInput.current?.click()} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-line-strong bg-paper p-4 text-left transition-colors hover:border-primary"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-tint text-primary"><Icon name="plus" /></span><span><span className="block text-sm font-medium">{term ? "Make something of your own" : "Turn an inside joke into a sticker"}</span><span className="mt-1 block text-xs text-muted">Choose a photo or transparent PNG</span></span></button>}
              </section>
              {originals.length ? <section aria-label="Little notes" className="space-y-3"><h3 className="text-sm font-medium text-muted">Little notes</h3><div className="grid grid-cols-4 gap-2">{originals.map((item) => <button key={item.id} type="button" disabled={working} aria-label={`Send ${item.label} sticker`} className={cn("rounded-xl p-2 text-center transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50", item.background)} onClick={() => { setNotice(""); void onSticker(item.id).then((sent) => { if (sent) setNotice("Sticker sent."); }); }}><span className="block text-4xl">{item.emoji}</span><span className="mt-2 block text-2xs font-medium">{item.label}</span></button>)}</div></section> : <p className="text-center text-sm text-muted">No matching little notes.</p>}
            </>}
        </div>
      </div>}
    </div>
  </BottomSheet>;
}

function CandidatePreview({ sticker }: { sticker: PreparedSticker }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const preview = URL.createObjectURL(new Blob([new Uint8Array(sticker.bytes)], { type: "image/png" }));
    let live = true;
    queueMicrotask(() => { if (live) setUrl(preview); });
    return () => { live = false; URL.revokeObjectURL(preview); };
  }, [sticker]);
  return <div className="grid place-items-center rounded-2xl border border-line bg-paper p-4">{url ? <Image unoptimized src={url} alt="Your custom sticker preview" width={512} height={512} className="size-40 object-contain" /> : null}</div>;
}
