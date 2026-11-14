"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { STICKERS } from "@/lib/together/catalog";
import { chatAAD, decryptBytes, decryptText, encryptText, type ChatKey } from "@/lib/together/chat-crypto";
import { togetherFetch, errorMessage } from "@/lib/together/client";
import type { MessageDTO } from "@/lib/together/types";

export function SecureMessage({ message, chatKey, coupleId, mine, append }: { message: MessageDTO; chatKey: ChatKey; coupleId: string; mine: boolean; append: (row: MessageDTO) => void }) {
  const [decoded, setDecoded] = useState<{ source: string; value: string } | null>(null), [error, setError] = useState("");
  const [menu, setMenu] = useState(false), [editing, setEditing] = useState(false), [draft, setDraft] = useState(""), [busy, setBusy] = useState(false);
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
    if (busy) return; setBusy(true); setError("");
    try {
      append(await togetherFetch<MessageDTO>("/api/together/messages", { body: { action, id: message.id, version: message.version, ...(action === "edit" ? { body: await encryptText(chatKey, draft.trim(), aad) } : {}) } }));
      setMenu(false); setEditing(false);
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };
  return <>
    {message.deleted ? <p className="text-sm italic text-muted">Message deleted</p> : message.image ? <SecurePhoto message={message} chatKey={chatKey} coupleId={coupleId} mine={mine} /> : sticker ? <div className="py-1 text-center"><span role="img" aria-label={sticker.label} className="block text-5xl">{sticker.emoji}</span><p className="text-xs">{sticker.label}</p></div> : <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{body || (message.kind === "GAME" ? "Game update" : error ? "Unable to decrypt" : "Decrypting…")}</p>}
    {message.editedAt ? <span className="text-2xs text-muted">Edited</span> : null}
    <button type="button" aria-label="Message options" className="ml-2 rounded px-2 text-xs text-muted hover:bg-surface" onClick={() => setMenu(true)}>•••</button>
    {error && !menu ? <p role="alert" className="text-xs text-error">{error}</p> : null}
    <BottomSheet open={menu} onClose={() => { if (!busy) { setMenu(false); setEditing(false); } }} title={editing ? "Edit message" : "Message options"}>
      <div className="space-y-3">
        {editing ? <><Textarea aria-label="Edit your message" maxLength={4000} value={draft} onChange={(event) => setDraft(event.target.value)} /><Button loading={busy} disabled={!draft.trim()} onClick={() => void action("edit")}>Save edit</Button></> : <>
          {mine && !message.deleted && message.kind === "TEXT" && message.encrypted && body ? <Button variant="secondary" disabled={busy} onClick={() => { setDraft(body); setEditing(true); }}>Edit</Button> : null}
          <Button variant="secondary" disabled={busy} onClick={() => void action("delete-me")}>Delete for me</Button>
          {mine && !message.deleted ? <Button variant="danger" disabled={busy} onClick={() => void action("delete-everyone")}>Delete for everyone</Button> : null}
          <p className="text-xs text-muted">Delete for me hides this message on your devices. Delete for everyone removes it from MONO for both partners; already saved copies cannot be recalled.</p>
        </>}
        {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
      </div>
    </BottomSheet>
  </>;
}
function SecurePhoto({ message, chatKey, coupleId, mine }: { message: MessageDTO; chatKey: ChatKey; coupleId: string; mine: boolean }) {
  const [url, setUrl] = useState(""), [opened, setOpened] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [used, setUsed] = useState(message.image!.viewsUsed);
  const resource = useRef(""), operation = useRef(0), active = useRef(false);
  const image = message.image!, limited = image.viewLimit > 0;
  const close = () => { operation.current++; active.current = false; if (resource.current) URL.revokeObjectURL(resource.current); resource.current = ""; setUrl(""); setOpened(false); setBusy(false); };
  useEffect(() => {
    const hide = () => { if (document.hidden && limited) close(); };
    const pageHide = () => { if (limited) close(); };
    document.addEventListener("visibilitychange", hide); window.addEventListener("pagehide", pageHide);
    return () => { operation.current = -1; active.current = false; URL.revokeObjectURL(resource.current); document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", pageHide); };
  }, [limited]);
  const open = async () => {
    if (active.current) return; active.current = true; const requestId = ++operation.current; setBusy(true); setError("");
    try {
      let blob: Blob;
      if (image.encrypted) {
        const payload = await togetherFetch<{ iv: string; data: string; viewsUsed: number }>(image.url, limited ? { body: {} } : {});
        setUsed(payload.viewsUsed);
        const bytes = await decryptBytes(chatKey, payload, chatAAD(coupleId, message.senderId, message.clientNonce, `IMAGE_BYTES:${image.viewLimit}`));
        blob = new Blob([new Uint8Array(bytes)], { type: image.contentType }); bytes.fill(0);
      } else {
        const response = await fetch(image.url, { cache: "no-store" });
        if (!response.ok) throw new Error("Photo unavailable.");
        blob = await response.blob();
      }
      if (requestId !== operation.current || document.hidden) return;
      const next = URL.createObjectURL(blob); resource.current = next; setUrl(next); setOpened(true);
    } catch (e) { if (requestId === operation.current) setError(errorMessage(e)); }
    finally { if (requestId === operation.current) { active.current = false; setBusy(false); } }
  };
  const remaining = Math.max(0, image.viewLimit - Math.max(used, image.viewsUsed));
  return <div className="space-y-1">
    <Button variant="secondary" size="sm" loading={busy} disabled={limited && !mine && remaining === 0} onClick={() => void open()}>{limited ? mine ? `Your photo · View ${image.viewLimit === 1 ? "once" : "twice"}` : remaining ? `Open photo · ${remaining} ${remaining === 1 ? "view" : "views"} left` : "Photo opened" : image.encrypted ? "Open encrypted photo" : "Open photo · legacy"}</Button>
    {limited ? <p className="max-w-xs text-2xs text-muted">Closes when you leave MONO. Screenshots and recordings cannot be blocked or detected.</p> : null}
    {error ? <p role="alert" className="text-xs text-error">{error}{limited ? " A failed download may still use a view." : ""}</p> : null}
    <BottomSheet open={opened} onClose={close} title={limited ? "Private photo" : "Shared photo"} footer={<Button onClick={close}>Close photo</Button>}>
      {opened && url ? <Image unoptimized src={url} alt="Shared private chat photo" width={image.width} height={image.height} draggable={false} className="max-h-[65dvh] w-auto max-w-full select-none rounded-lg object-contain" /> : null}
    </BottomSheet>
  </div>;
}
