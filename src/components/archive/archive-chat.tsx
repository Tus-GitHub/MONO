"use client";
import { useCallback, useState } from "react";
import Image from "next/image";
import { ChatEncryption } from "@/components/together/chat-encryption";
import { SecureMessage } from "@/components/together/secure-message";
import { Button } from "@/components/ui/button";
import { togetherFetch, errorMessage } from "@/lib/together/client";
import type { ChatKey } from "@/lib/together/chat-crypto";
import type { MessageDTO } from "@/lib/together/types";

type ChatPage = { messages: MessageDTO[]; nextCursor: string | null };
const noRefresh = async () => {};
const noEdit = () => {};
export function ArchiveChat({ coupleId, userId, keyId, initial }: { coupleId: string; userId: string; keyId: string | null; initial: ChatPage }) {
  const [key, setKey] = useState<ChatKey | null>(null), [page, setPage] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const unlock = useCallback((value: ChatKey) => setKey(value), []);
  const older = async () => {
    if (busy || !page.nextCursor) return;
    setBusy(true); setError("");
    try { const next = await togetherFetch<ChatPage>(`/api/history-access/${coupleId}/chat?before=${page.nextCursor}`); setPage(value => ({ messages: [...next.messages, ...value.messages], nextCursor: next.nextCursor })); }
    catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  };
  return <div className="space-y-4">
    {keyId && !key ? <ChatEncryption readOnly coupleId={coupleId} userId={userId} keyId={keyId} onUnlock={unlock} refresh={noRefresh} /> : null}
    <p className="text-sm text-muted">Saved chat is read-only. Admin approval does not replace your original encryption key. Hidden messages and limited-photo view counts stay unchanged.</p>
    {page.nextCursor ? <Button variant="secondary" loading={busy} onClick={() => void older()}>Load older messages</Button> : null}
    {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
    {!page.messages.length ? <p className="text-sm text-muted">No saved messages.</p> : null}
    <ol className="space-y-3">{page.messages.map(message => <li key={message.id} className={`max-w-lg space-y-2 rounded-xl border border-line p-4 ${message.senderId === userId ? "ml-auto bg-primary-tint" : "mr-auto bg-surface"}`}>
      <p className="text-2xs text-muted">{message.senderId === userId ? "You" : "Deleted partner"} · {new Date(message.createdAt).toLocaleString()}</p>
      {key ? <SecureMessage message={message} chatKey={key} coupleId={coupleId} mine={message.senderId === userId} append={noEdit} readOnly videoUrl={`/api/history-access/${coupleId}/videos/${message.id}`} /> : message.deleted ? <p className="text-sm italic text-muted">Message deleted</p> : !message.encrypted ? <>
        <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{message.body || (message.kind === "GAME" ? "Game update" : "")}</p>
        {message.image && !message.image.encrypted ? <Image unoptimized src={message.image.url} alt="Saved chat photo" width={message.image.width || 640} height={message.image.height || 480} className="h-auto max-w-full rounded-lg" /> : null}
      </> : <p className="text-sm text-muted">Unlock chat to read this message.</p>}
    </li>)}</ol>
  </div>;
}
