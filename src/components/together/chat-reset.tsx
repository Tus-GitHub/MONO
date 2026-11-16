"use client";
import { useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { newRecoveryCode, recoverChatKey, storedChatKey } from "@/lib/together/chat-crypto";
import { togetherFetch, errorMessage } from "@/lib/together/client";
import type { ChatResetDelivery } from "@/lib/validation/chat-reset";

export function ChatReset({ open, onClose, coupleId, userId, currentKeyId, refresh }: {
  open: boolean; onClose: () => void; coupleId: string; userId: string; currentKeyId: string | null; refresh: () => Promise<void>;
}) {
  const [delivery, setDelivery] = useState<ChatResetDelivery | null>(null), [recovery, setRecovery] = useState("");
  const [nextKeyId, setNextKeyId] = useState("");
  const [ownCode, setOwn] = useState(""), [partnerCode, setPartner] = useState(""), [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [done, setDone] = useState(false), [copied, setCopied] = useState(false);
  const running = useRef(false);
  // Polling also confirms a successful reset if its HTTP response was lost.
  const completed = done || Boolean(delivery && nextKeyId && currentKeyId === nextKeyId);
  const clear = () => { setDelivery(null); setRecovery(""); setNextKeyId(""); setOwn(""); setPartner(""); setSaved(false); setError(""); setDone(false); setCopied(false); };
  const request = async () => {
    if (running.current) return;
    running.current = true; setBusy(true); setError("");
    try {
      const code = newRecoveryCode(), key = await recoverChatKey(code, coupleId);
      const next = await togetherFetch<ChatResetDelivery>("/api/together/encryption/reset", { body: { action: "request", keyId: key.id } });
      setDelivery(next); setRecovery(code); setNextKeyId(key.id); setOwn(""); setPartner(""); setSaved(false); setCopied(false);
    } catch (error) { setError(errorMessage(error)); }
    finally { running.current = false; setBusy(false); }
  };
  const confirm = async () => {
    if (running.current || !delivery || !saved || !/^\d{6}$/.test(ownCode) || !/^\d{6}$/.test(partnerCode)) return;
    running.current = true; setBusy(true); setError("");
    try {
      // Persist the exact key being approved, without replacing this device's active key.
      // A refused resend must not overwrite this backup with an unused key.
      await storedChatKey(`${userId}:${coupleId}:pending-reset`, await recoverChatKey(recovery, coupleId));
      await togetherFetch("/api/together/encryption/reset", { body: { action: "confirm", requestId: delivery.requestId, ownCode, partnerCode, acknowledged: true } });
      setDone(true); setOwn(""); setPartner(""); await refresh();
    } catch (error) { setError(errorMessage(error)); await refresh(); }
    finally { running.current = false; setBusy(false); }
  };
  const close = async () => {
    if (running.current) return;
    if (delivery && !completed) {
      running.current = true; setBusy(true);
      try { await togetherFetch("/api/together/encryption/reset", { body: { action: "cancel", requestId: delivery.requestId } }); }
      catch { /* Unsubmitted requests also expire automatically; no key has changed. */ }
      finally { running.current = false; setBusy(false); }
    }
    onClose(); clear();
  };
  const invalidOwn = ownCode.length > 0 && ownCode.length !== 6, invalidPartner = partnerCode.length > 0 && partnerCode.length !== 6;
  return <BottomSheet open={open} onClose={() => void close()} title="Reset encrypted chat" description="Both email codes are required together."
    footer={completed ? <Button fullWidth onClick={() => void close()}>Unlock with your new code</Button> : delivery ? <Button fullWidth loading={busy} disabled={!saved || !/^\d{6}$/.test(ownCode) || !/^\d{6}$/.test(partnerCode)} onClick={() => void confirm()}>Reset chat with both codes</Button> : <Button fullWidth loading={busy} onClick={() => void request()}>Email both approval codes</Button>}>
    <div className="space-y-4">
      {completed ? <p role="status" className="text-sm text-ink">Chat has been reset. Both partners must unlock it with the new recovery code below.</p> : <p className="text-sm text-muted">Use this only when you cannot recover your current chat key. Old chat messages, photos, videos, documents and custom stickers will leave the active conversation. This does not permanently delete the stored old history.</p>}
      <p className="rounded-lg border border-line bg-surface p-3 text-sm text-muted">Your accounts, couple space, dates, Memories, other photos, expenses and games stay unchanged.</p>
      {delivery && !completed ? <>
        <p role="status" className="text-sm text-muted">Codes sent to {delivery.ownEmail} and {delivery.partnerEmail}. Request {delivery.requestId.slice(0, 8)} · valid for 10 minutes.</p>
        <Field label="Your email OTP" htmlFor="chat-reset-own" errors={invalidOwn ? ["Enter all six digits."] : undefined}>
          <Input id="chat-reset-own" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={ownCode} invalid={invalidOwn} aria-describedby={invalidOwn ? "chat-reset-own-error" : undefined} onChange={event => setOwn(event.target.value.replace(/\D/g, "").slice(0, 6))} />
        </Field>
        <Field label="Partner's email OTP" htmlFor="chat-reset-partner" errors={invalidPartner ? ["Enter all six digits."] : undefined}>
          <Input id="chat-reset-partner" inputMode="numeric" autoComplete="off" maxLength={6} value={partnerCode} invalid={invalidPartner} aria-describedby={invalidPartner ? "chat-reset-partner-error" : undefined} onChange={event => setPartner(event.target.value.replace(/\D/g, "").slice(0, 6))} />
        </Field>
      </> : null}
      {recovery ? <div className="space-y-2">
        <h3 className="text-sm font-medium text-ink">Your new shared recovery code</h3>
        <p className="select-all break-all rounded-lg bg-paper p-3 font-mono text-xs text-ink">{recovery}</p>
        <p className="text-xs text-muted">Save this privately and share it with your partner. AMOR cannot recover it. This is different from the two email OTPs.</p>
        <Button size="sm" variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(recovery); setCopied(true); } catch { setError("Select and copy the recovery code manually."); } }}>{copied ? "Copied" : "Copy new recovery code"}</Button>
        {!completed ? <label className="flex items-start gap-2 text-sm"><Checkbox checked={saved} onChange={event => setSaved(event.target.checked)} />I saved the new recovery code. We both agree to start a fresh chat.</label> : null}
      </div> : null}
      {error && !completed ? <p role="alert" className="text-sm text-error">{error}</p> : null}
      {delivery && !completed ? <Button size="sm" variant="link" disabled={busy} onClick={() => void request()}>Send new codes to both emails</Button> : null}
    </div>
  </BottomSheet>;
}
