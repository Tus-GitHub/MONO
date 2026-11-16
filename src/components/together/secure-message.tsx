"use client";
import Image from "next/image";
import { SecureVideo } from "./secure-video";
import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { documentName, downloadAttachment, photoForSaving, saveAttachment } from "@/lib/together/attachments";
import { SavedPhotoCropDialog } from "@/components/uploads/saved-photo-crop-dialog";
import { readSavedCrop } from "@/lib/images/saved-crop";
import { STICKERS } from "@/lib/together/catalog";
import { readStickerMetadata } from "@/lib/together/stickers";
import { StickerImage } from "./sticker-image";
import { chatAAD, decryptBytes, decryptText, encryptText, type ChatKey } from "@/lib/together/chat-crypto";
import { togetherFetch, errorMessage } from "@/lib/together/client";
import type { MessageDTO } from "@/lib/together/types";

export function SecureMessage({ message, chatKey, coupleId, mine, append, readOnly = false, videoUrl }: { message: MessageDTO; chatKey: ChatKey; coupleId: string; mine: boolean; append: (row: MessageDTO) => void; readOnly?: boolean; videoUrl?: string }) {
  const [decoded, setDecoded] = useState<{ source: string; value: string } | null>(null), [error, setError] = useState("");
  const [menu, setMenu] = useState(false), [editing, setEditing] = useState(false), [draft, setDraft] = useState(""), [busy, setBusy] = useState(false);
  const press = useRef<{ x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null), held = useRef(false);
  const cancelPress = () => { if (press.current) clearTimeout(press.current.timer); press.current = null; };
  useEffect(() => () => { if (press.current) clearTimeout(press.current.timer); }, []);
  const aad = chatAAD(coupleId, message.senderId, message.clientNonce, message.kind);
  useEffect(() => {
    if (!message.encrypted || !message.body || message.deleted) return;
    let live = true;
    decryptText(chatKey, message.body, aad).then((value) => { if (live) { setDecoded({ source: message.body, value }); setError(""); } }).catch(() => { if (live) setError("This message could not be decrypted. Check your recovery code."); });
    return () => { live = false; };
  }, [message.body, message.encrypted, message.deleted, chatKey, aad]);
  const body = message.encrypted ? decoded?.source === message.body ? decoded.value : "" : message.body;
  const sticker = message.kind === "STICKER" ? STICKERS.find((s) => s.id === body) : null;
  const action = async (action: "edit" | "delete-me" | "delete-everyone") => {
    if (busy || readOnly) return; setBusy(true); setError("");
    try {
      append(await togetherFetch<MessageDTO>("/api/together/messages", { body: { action, id: message.id, version: message.version, ...(action === "edit" ? { body: await encryptText(chatKey, draft.trim(), aad) } : {}) } }));
      setMenu(false); setEditing(false);
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };
  return <div className="mono-message group relative pr-4" onPointerDown={(event) => {
    if (readOnly || menu || event.button !== 0 || (event.target as Element).closest('[role="dialog"], video')) return;
    held.current = false; cancelPress();
    press.current = { x: event.clientX, y: event.clientY, timer: setTimeout(() => { held.current = true; setMenu(true); navigator.vibrate?.(20); }, 500) };
  }} onPointerMove={(event) => { if (press.current && Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > 10) cancelPress(); }} onPointerUp={cancelPress} onPointerCancel={cancelPress} onPointerLeave={cancelPress}
    onClickCapture={(event) => { if (held.current) { held.current = false; event.preventDefault(); event.stopPropagation(); } }}
    onContextMenu={(event) => { if (readOnly || (event.target as Element).closest('[role="dialog"], video')) return; event.preventDefault(); cancelPress(); setMenu(true); }}>
    {message.deleted ? <p className="text-sm italic text-muted">Message deleted</p> : message.kind === "VIDEO" ? <SecureVideo message={message} body={body} chatKey={chatKey} coupleId={coupleId} videoUrl={videoUrl} /> : message.kind === "STICKER" && message.image ? <StickerImage message={message} chatKey={chatKey} coupleId={coupleId} label={readStickerMetadata(body)?.name ?? "Custom sticker"} className="size-32 sm:size-36" /> : message.kind === "DOCUMENT" && message.image ? <SecureDocument message={message} body={body} chatKey={chatKey} coupleId={coupleId} /> : message.image ? <SecurePhoto message={message} chatKey={chatKey} coupleId={coupleId} mine={mine} append={append} readOnly={readOnly} /> : sticker ? <div className="py-1 text-center"><span role="img" aria-label={sticker.label} className="block text-5xl">{sticker.emoji}</span><p className="text-xs">{sticker.label}</p></div> : <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{body || (message.kind === "GAME" ? "Game update" : error ? "Unable to decrypt" : "Decrypting…")}</p>}
    {message.editedAt ? <span className="text-2xs text-muted">Edited</span> : null}
    {!readOnly ? <button type="button" aria-label="Message options" title="Hold a message or right-click for options" className="absolute -right-1 -top-1 rounded-md p-1 text-muted opacity-0 transition-opacity hover:bg-surface group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100" onClick={() => setMenu(true)}><Icon name="moreHorizontal" size="sm" /></button> : null}
    {error && !menu ? <p role="alert" className="text-xs text-error">{error}</p> : null}
    <BottomSheet open={menu} onClose={() => { if (!busy) { setMenu(false); setEditing(false); } }} title={editing ? "Edit message" : "Message options"}>
      <div className="space-y-3">
        {editing ? <><Textarea aria-label="Edit your message" maxLength={4000} value={draft} onChange={(event) => setDraft(event.target.value)} /><Button loading={busy} disabled={!draft.trim()} onClick={() => void action("edit")}>Save edit</Button></> : <>
          {message.kind === "TEXT" && body && !message.deleted ? <Button variant="secondary" fullWidth onClick={() => { void navigator.clipboard.writeText(body).then(() => setMenu(false)).catch(() => setError("Copy is unavailable. Try selecting the text.")); }}><Icon name="copy" size="sm" /> Copy text</Button> : null}
          {mine && !message.deleted && message.kind === "TEXT" && message.encrypted && body ? <Button variant="secondary" fullWidth disabled={busy} onClick={() => { setDraft(body); setEditing(true); }}><Icon name="pencil" size="sm" /> Edit message</Button> : null}
          <Button variant="secondary" fullWidth disabled={busy} onClick={() => void action("delete-me")}><Icon name="trash" size="sm" /> Delete for me</Button>
          {mine && !message.deleted ? <Button variant="danger" fullWidth disabled={busy} onClick={() => void action("delete-everyone")}><Icon name="trash" size="sm" /> Delete for everyone</Button> : null}
          <p className="text-xs text-muted">Delete for me hides this message on your devices. Delete for everyone removes it from AMOR for both partners; already saved copies cannot be recalled.</p>
        </>}
        {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
      </div>
    </BottomSheet>
  </div>;
}
function SecurePhoto({ message, chatKey, coupleId, mine, append, readOnly }: { message: MessageDTO; chatKey: ChatKey; coupleId: string; mine: boolean; append: (row: MessageDTO) => void; readOnly?: boolean }) {
  const [url, setUrl] = useState(""), [opened, setOpened] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [used, setUsed] = useState(message.image!.viewsUsed);
  const [adjusting, setAdjusting] = useState(false);
  const downloadable = useRef<Blob | null>(null);
  const resource = useRef(""), operation = useRef(0), active = useRef(false);
  const image = message.image!, limited = image.viewLimit > 0;
  const loadPhoto = async (signal?: AbortSignal) => {
    if (image.encrypted) {
      const payload = await togetherFetch<{ iv: string; data: string; viewsUsed: number }>(image.url, { ...(limited ? { body: {} } : {}), signal });
      setUsed(payload.viewsUsed);
      const bytes = await decryptBytes(chatKey, payload, chatAAD(coupleId, message.senderId, message.clientNonce, `IMAGE_BYTES:${image.viewLimit}`));
      const blob = new Blob([new Uint8Array(bytes)], { type: image.contentType }); bytes.fill(0);
      return blob;
    }
    const response = await fetch(image.url, { cache: "no-store", signal });
    if (!response.ok) throw new Error("Photo unavailable.");
    return response.blob();
  };
  const close = () => { downloadable.current = null; operation.current++; active.current = false; if (resource.current) URL.revokeObjectURL(resource.current); resource.current = ""; setUrl(""); setOpened(false); setBusy(false); };
  useEffect(() => {
    const hide = () => { if (document.hidden && limited) close(); };
    const pageHide = () => { if (limited) close(); };
    document.addEventListener("visibilitychange", hide); window.addEventListener("pagehide", pageHide);
    return () => { operation.current = -1; active.current = false; URL.revokeObjectURL(resource.current); document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", pageHide); };
  }, [limited]);
  const open = async () => {
    if (active.current) return; active.current = true; const requestId = ++operation.current; setBusy(true); setError("");
    try {
      const blob = await loadPhoto();
      if (requestId !== operation.current || document.hidden) return;
      const saved = !limited ? await photoForSaving(blob, readSavedCrop(image.crop)) : null;
      if (requestId !== operation.current || document.hidden) return;
      downloadable.current = saved;
      const next = URL.createObjectURL(blob); resource.current = next; setUrl(next); setOpened(true);
    } catch (e) { if (requestId === operation.current) setError(errorMessage(e)); }
    finally { if (requestId === operation.current) { active.current = false; setBusy(false); } }
  };
  const remaining = Math.max(0, image.viewLimit - Math.max(used, image.viewsUsed));
  const crop = readSavedCrop(image.crop) ?? { x: 0, y: 0, width: 1, height: 1 };
  const aspect = image.width * crop.width / (image.height * crop.height);
  return <div className="space-y-1">
    <button type="button" className="flex min-h-20 w-full max-w-64 items-center gap-3 rounded-xl bg-paper/50 p-3 text-left disabled:opacity-50" disabled={busy || (limited && !mine && remaining === 0)} onClick={() => void open()}><span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-tint text-primary">{limited ? <span className="font-display text-xl">{image.viewLimit}</span> : <Icon name="images" />}</span><span><span className="block text-sm font-medium">{busy ? "Opening…" : limited ? mine ? `Your photo · View ${image.viewLimit === 1 ? "once" : "twice"}` : remaining ? `Open photo · ${remaining} ${remaining === 1 ? "view" : "views"} left` : "Photo opened" : "Open photo"}</span><span className="mt-1 block text-2xs text-muted">{limited ? "Limited-view photo" : "Keep, save or share"}</span></span></button>
    {limited ? <p className="max-w-xs text-2xs text-muted">Closes when you leave AMOR. Screenshots and recordings cannot be blocked or detected.</p> : null}
    {error ? <p role="alert" className="text-xs text-error">{error}{limited ? " A failed download may still use a view." : ""}</p> : null}
    <BottomSheet open={opened} onClose={close} title={limited ? "Private photo" : "Shared photo"} footer={<div className="flex flex-wrap gap-2">{!limited ? <Button variant="secondary" onClick={() => { const blob = downloadable.current; if (blob) void saveAttachment(blob, `AMOR-${message.id}.${blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg"}`).catch((e) => { if (e?.name !== "AbortError") setError("Use your browser’s download or share menu to save this photo."); }); }}><Icon name="share" size="sm" /> Save / share photo</Button> : null}{mine && !readOnly ? <Button variant="ghost" onClick={() => { close(); setAdjusting(true); }}><Icon name="crop" size="sm" />Adjust crop</Button> : null}<Button onClick={close}>Close photo</Button></div>}>
      {error ? <p role="alert" className="mb-2 text-sm text-error">{error}</p> : null}
      {opened && url ? <div className="relative overflow-hidden rounded-lg" style={{ aspectRatio: aspect, width: `min(100%, ${65 * aspect}dvh)` }}>
        <Image unoptimized src={url} alt="Shared private chat photo" width={image.width} height={image.height} draggable={false} className="absolute max-w-none select-none"
          style={{ width: `${100 / crop.width}%`, height: `${100 / crop.height}%`, left: `${-100 * crop.x / crop.width}%`, top: `${-100 * crop.y / crop.height}%` }} />
      </div> : null}
    </BottomSheet>
    {adjusting && !readOnly ? <SavedPhotoCropDialog kind="chat" id={message.id} loadSource={(_info, signal) => loadPhoto(signal)} onCancel={() => setAdjusting(false)} onSaved={(result) => { if (result.message) append(result.message); setAdjusting(false); }} /> : null}
  </div>;
}

function SecureDocument({ message, body, chatKey, coupleId }: { message: MessageDTO; body: string; chatKey: ChatKey; coupleId: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  let name = "Document", size = 0;
  try { const meta = JSON.parse(body); name = documentName(typeof meta.name === "string" ? meta.name : "document.bin"); size = Number(meta.size) || 0; } catch { /* Metadata is still decrypting. */ }
  const download = async () => {
    setBusy(true); setError("");
    try {
      const payload = await togetherFetch<{ iv: string; data: string }>(message.image!.url);
      const bytes = await decryptBytes(chatKey, payload, chatAAD(coupleId, message.senderId, message.clientNonce, "DOCUMENT_BYTES"));
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" }); bytes.fill(0);
      downloadAttachment(blob, name);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return <div className="space-y-2"><div className="flex items-center gap-3"><span className="rounded-lg bg-paper p-3 text-primary"><Icon name="document" /></span><div className="min-w-0"><p className="break-all text-sm font-medium">{name}</p><p className="text-2xs text-muted">{size ? `${Math.ceil(size / 1024)} KB · ` : ""}End-to-end encrypted</p></div></div><Button size="sm" variant="secondary" loading={busy} disabled={!body} onClick={() => void download()}><Icon name="download" size="sm" /> Save document</Button>{error ? <p role="alert" className="text-xs text-error">{error}</p> : null}</div>;
}
