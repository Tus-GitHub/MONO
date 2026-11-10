"use client";

import { useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { AuthSessionView } from "@/lib/auth/session-view";
import { settingsErrorMessage, settingsRequest } from "@/lib/settings/request";

type SessionAction = { action: "revoke"; sessionId: string } | { action: "revoke-others" | "revoke-all" };

export function SessionSettings({ initial, timezone }: { initial: AuthSessionView[]; timezone: string }) {
  const [sessions, setSessions] = useState(initial);
  const [pending, setPending] = useState<string | null>(null);
  const busy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const confirm = useConfirm();
  const formatter = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: timezone });
  const otherCount = sessions.filter((session) => !session.current).length;

  async function refresh() {
    if (busy.current) return;
    busy.current = true; setPending("refresh"); setError(null); setMessage(null);
    try {
      const result = await settingsRequest<{ sessions: AuthSessionView[] }>("/api/account/sessions");
      setSessions(result.sessions); setMessage("Your device list is up to date.");
    } catch (failure) { setError(settingsErrorMessage(failure)); }
    finally { busy.current = false; setPending(null); }
  }

  async function revoke(input: SessionAction, device?: AuthSessionView) {
    if (busy.current) return;
    busy.current = true; setPending(input.action === "revoke" ? input.sessionId : input.action);
    setError(null); setMessage(null);
    try {
      const signedOut = input.action === "revoke-all" || Boolean(device?.current);
      const accepted = await confirm({
        title: input.action === "revoke-all" ? "Sign out everywhere?"
          : input.action === "revoke-others" ? "Sign out other devices?"
          : device?.current ? "Sign out this device?" : "Sign out this session?",
        description: signedOut ? "You'll need to sign in again on this device."
          : "These sessions will end and their browser notifications will stop. This device stays signed in.",
        confirmLabel: "Sign out", tone: "danger",
      });
      if (!accepted) return;
      const result = await settingsRequest<{ signedOut: boolean }>("/api/account/sessions", input);
      if (result.signedOut) { window.location.replace("/login?signedOut=1"); return; }
      setSessions((current) => current.filter((session) => input.action === "revoke"
        ? session.id !== input.sessionId : session.current));
      setMessage(input.action === "revoke-others" ? "Other devices have been signed out." : "The session has been signed out.");
    } catch (failure) { setError(settingsErrorMessage(failure)); }
    finally { busy.current = false; setPending(null); }
  }

  return (
    <div className="space-y-5">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Only your sessions are shown. Times are in {timezone}.</p>
        <Button variant="secondary" size="sm" onClick={refresh} disabled={pending !== null} loading={pending === "refresh"}>Refresh list</Button>
      </div>
      <ul className="space-y-3" aria-label="Your signed-in devices" aria-busy={pending !== null}>
        {sessions.map((session) => (
          <li key={session.id} data-session-id={session.id} className="space-y-3 rounded-xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-sm font-medium text-ink">{session.deviceLabel}</h2>
              {session.current ? <Badge tone="success">This device</Badge> : null}
            </div>
            <dl className="space-y-1 text-xs text-muted">
              <div><dt className="inline">Last active: </dt><dd className="inline"><time dateTime={session.lastSeenAt}>{formatter.format(new Date(session.lastSeenAt))}</time></dd></div>
              <div><dt className="inline">Signed in: </dt><dd className="inline"><time dateTime={session.createdAt}>{formatter.format(new Date(session.createdAt))}</time></dd></div>
              <div><dt className="inline">Expires: </dt><dd className="inline"><time dateTime={session.expiresAt}>{formatter.format(new Date(session.expiresAt))}</time></dd></div>
            </dl>
            <Button variant="secondary" size="sm" disabled={pending !== null} loading={pending === session.id}
              aria-label={`Sign out ${session.current ? "this device" : session.deviceLabel} session`}
              onClick={() => revoke({ action: "revoke", sessionId: session.id }, session)}>
              {session.current ? "Sign out this device" : "Sign out session"}
            </Button>
          </li>
        ))}
      </ul>
      <div className="space-y-3 rounded-xl border border-line bg-surface p-5">
        <h2 className="text-sm font-medium text-ink">Manage all devices</h2>
        <p className="text-sm text-muted">Signing out a device also removes its browser notification subscription.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled={pending !== null || otherCount === 0}
            loading={pending === "revoke-others"} onClick={() => revoke({ action: "revoke-others" })}>Sign out other devices</Button>
          <Button variant="danger" size="sm" disabled={pending !== null}
            loading={pending === "revoke-all"} onClick={() => revoke({ action: "revoke-all" })}>Sign out everywhere</Button>
        </div>
      </div>
    </div>
  );
}
