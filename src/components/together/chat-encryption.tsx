"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { chatAAD, decryptBytes, decryptText, encryptBytes, encryptText, newRecoveryCode, recoverChatKey, storedChatKey, type ChatKey } from "@/lib/together/chat-crypto";
import { togetherFetch, errorMessage } from "@/lib/together/client";
import type { MessageDTO } from "@/lib/together/types";

export function ChatEncryption({ coupleId, userId, keyId, onUnlock, refresh }: { coupleId: string; userId: string; keyId: string | null; onUnlock: (key: ChatKey) => void; refresh: () => Promise<void> }) {
  const [code, setCode] = useState(""), [generated, setGenerated] = useState(false), [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [status, setStatus] = useState("Checking this device…");
  const scope = `${userId}:${coupleId}`;
  useEffect(() => {
    let live = true;
    storedChatKey(scope).then((key) => { if (!live) return; if (key && key.id === keyId) onUnlock(key); setStatus(""); }).catch((error) => { if (live) { setError(errorMessage(error)); setStatus(""); } });
    return () => { live = false; };
  }, [scope, keyId, onUnlock]);
  const unlock = async () => {
    if (busy || (!keyId && (!generated || !saved))) return;
    setBusy(true); setError("");
    try {
      const key = await recoverChatKey(code, coupleId);
      if (keyId && key.id !== keyId) throw new Error("That code does not match this chat. Ask your partner for the original code.");
      // Persist before registering. Failure must not leave a server key with no local copy.
      await storedChatKey(scope, key);
      await togetherFetch("/api/together/encryption", { body: { action: "register", keyId: key.id } });
      setCode(""); await refresh(); onUnlock(key);
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  };
  return <div className="space-y-3 border-b border-line bg-surface p-4">
    <h2 className="font-display text-lg">{keyId ? "Unlock encrypted chat" : "Secure your chat"}</h2>
    <p className="text-sm text-muted">Messages, stickers and chat photos are encrypted on your device. Keep the recovery code somewhere safe and share it privately with your partner, outside MONO. MONO cannot recover it.</p>
    {keyId ? <Input aria-label="Private recovery code" type="password" autoComplete="off" value={code} onChange={(event) => setCode(event.target.value)} placeholder="MONO1-…" /> : <>
      {!generated ? <Button size="sm" onClick={() => { setCode(newRecoveryCode()); setGenerated(true); }}>Generate recovery code</Button> : <>
        <p className="break-all rounded-lg bg-paper p-3 font-mono text-sm select-all">{code}</p>
        <Button size="sm" variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(code); setStatus("Code copied. Store it privately before continuing."); } catch { setError("Copy is unavailable. Select the code above and copy it manually."); } }}>Copy code</Button>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} />I saved this code privately. I understand that losing the code and my devices makes history unreadable.</label>
      </>}
    </>}
    <Button size="sm" disabled={!code || (!keyId && !saved)} loading={busy} onClick={() => void unlock()}>{keyId ? "Unlock on this device" : "Enable encrypted chat"}</Button>
    {status ? <p role="status" className="text-sm text-muted">{status}</p> : null}
    {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
  </div>;
}
export function SecureHistory({ chatKey, coupleId, refresh }: { chatKey: ChatKey; coupleId: string; refresh: () => Promise<void> }) {
  const [remaining, setRemaining] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [count, setCount] = useState(0);
  const running = useRef(false);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    let live = true;
    togetherFetch<MessageDTO[]>("/api/together/encryption").then((rows) => { if (live) { setRemaining(Boolean(rows.length)); setChecked(true); } }).catch((e) => { if (live) setError(errorMessage(e)); });
    return () => { live = false; };
  }, [chatKey.id]);
  const migrate = async () => {
    if (running.current) return; running.current = true; setBusy(true); setError("");
    try {
      for (;;) {
        const rows = await togetherFetch<MessageDTO[]>("/api/together/encryption");
        if (!rows.length) break;
        for (const row of rows) {
          const aad = chatAAD(coupleId, row.senderId, row.clientNonce, row.kind);
          const body = await encryptText(chatKey, row.body, aad);
          if (await decryptText(chatKey, body, aad) !== row.body) throw new Error("History verification failed. Originals have been kept.");
          let image;
          if (row.image) {
            const response = await fetch(`${row.image.url}?migration=1`, { cache: "no-store" });
            if (!response.ok) throw new Error("Could not read an older photo. Retry securing history.");
            const bytes = new Uint8Array(await response.arrayBuffer());
            const imageAAD = chatAAD(coupleId, row.senderId, row.clientNonce, "IMAGE_BYTES:0");
            const encrypted = await encryptBytes(chatKey, bytes, imageAAD);
            const verified = await decryptBytes(chatKey, encrypted, imageAAD);
            if (verified.length !== bytes.length || !verified.every((byte, index) => byte === bytes[index])) throw new Error("Photo verification failed. The original is kept.");
            bytes.fill(0); verified.fill(0);
            image = { ...encrypted, keyId: chatKey.id, width: row.image.width, height: row.image.height };
          }
          await togetherFetch("/api/together/encryption", { body: { id: row.id, version: row.version, body, image } });
          setCount((value) => value + 1);
        }
      }
      setRemaining(false); await refresh();
    } catch (e) { setError(errorMessage(e)); }
    finally { running.current = false; setBusy(false); }
  };
  if (!checked && !error) return <p className="px-3 py-1 text-center text-2xs text-muted">Checking history encryption…</p>;
  if (!remaining && !error) return <p className="px-3 py-1 text-center text-2xs text-muted">End-to-end encrypted messages and photos · Keep your recovery code safe</p>;
  return <div className="space-y-1 border-b border-line p-3 text-sm">
    <p>Older messages are still stored without end-to-end encryption. Secure them from this device; keep chat open until it finishes. Previous backups may retain older copies.</p>
    <Button size="sm" loading={busy} onClick={() => void migrate()}>Secure existing history{count ? ` · ${count} secured` : ""}</Button>
    {error ? <p role="alert" className="text-error">{error}</p> : null}
  </div>;
}
