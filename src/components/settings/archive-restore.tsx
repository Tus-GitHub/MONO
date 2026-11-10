"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { ARCHIVE_MAX_BYTES } from "@/lib/archive/limits";
import { readArchivePreview, type ArchiveSelection } from "@/lib/archive/preview";
import { settingsErrorMessage, settingsRequest } from "@/lib/settings/request";

interface Approval { code: string; expiresAt: number }
interface RestoreResult { restored: boolean; dates: number; photos: number; memories: number }

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function ArchiveRestore({ spaceName, userEmail, blockedReason }: {
  spaceName: string | null; userEmail: string; blockedReason: string | null;
}) {
  const [selection, setSelection] = useState<ArchiveSelection | null>(null);
  const [filename, setFilename] = useState("");
  const [approval, setApproval] = useState<Approval | null>(null);
  const [expired, setExpired] = useState(false);
  const [consented, setConsented] = useState(false);
  const [partnerCode, setPartnerCode] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const busy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const confirm = useConfirm();
  const router = useRouter();
  const isExporter = selection?.summary.exporterEmail.toLowerCase() === userEmail.toLowerCase();
  const hasPartner = (selection?.summary.members.length ?? 0) > 1;

  useEffect(() => {
    if (!approval) return;
    const timeout = window.setTimeout(() => setExpired(true), Math.max(0, approval.expiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [approval]);

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    if (busy.current) return;
    const file = event.currentTarget.files?.[0];
    setSelection(null); setApproval(null); setPartnerCode(""); setConsented(false);
    setExpired(false); setError(null); setMessage(null); setFilename(file?.name ?? "");
    if (!file) return;
    busy.current = true; setPending("reading");
    try {
      if (file.size > ARCHIVE_MAX_BYTES) throw new Error("Choose an archive smaller than 64 MiB.");
      setSelection(readArchivePreview(await file.text()));
    } catch (failure) { setError(settingsErrorMessage(failure)); }
    finally { busy.current = false; setPending(null); }
  }

  async function approve() {
    if (!selection || !consented || busy.current) return;
    busy.current = true; setPending("approve"); setError(null); setMessage(null);
    try {
      const response = await settingsRequest<{ approval: string; digest: string; expiresInSeconds: number }>("/api/archive", {
        action: "approve", archive: selection.archive,
      });
      if (response.digest !== selection.summary.digest) throw new Error("The archive changed. Choose the file again.");
      setApproval({ code: response.approval, expiresAt: Date.now() + response.expiresInSeconds * 1000 });
      setExpired(false); setMessage("Your approval is ready. It is valid for 15 minutes while you stay signed in.");
    } catch (failure) { setError(settingsErrorMessage(failure)); }
    finally { busy.current = false; setPending(null); }
  }

  async function copyApproval() {
    if (!approval) return;
    try { await navigator.clipboard.writeText(approval.code); setMessage("Approval code copied. Share it only with your partner."); }
    catch { setMessage("Select the approval code below and copy it to share with your partner."); }
  }

  async function restore() {
    if (!selection || !approval || expired || !isExporter || busy.current) return;
    busy.current = true; setPending("confirm"); setError(null); setMessage(null);
    try {
      const accepted = await confirm({
        title: "Restore this archive?", confirmLabel: "Restore history",
        description: `Restore ${countLabel(selection.summary.dates, "date")}, ${countLabel(selection.summary.photos, "photo")} and ${countLabel(selection.summary.memories, "memory", "memories")} into ${spaceName || "your current shared space"}? This space can receive an archive only once.`,
      });
      if (!accepted) return;
      if (Date.now() >= approval.expiresAt) {
        setExpired(true);
        throw new Error("Your approval expired. Approve again before restoring.");
      }
      setPending("restore");
      const response = await settingsRequest<RestoreResult>("/api/archive", {
        action: "restore", archive: selection.archive,
        approvals: hasPartner ? [approval.code, partnerCode.trim()] : [approval.code],
      });
      setResult(response); setApproval(null); setPartnerCode(""); setSelection(null);
      router.refresh();
    } catch (failure) { setError(settingsErrorMessage(failure)); }
    finally { busy.current = false; setPending(null); }
  }

  if (result) return (
    <section className="space-y-4 rounded-xl border border-line bg-surface p-5">
      <Alert tone="success" title="Your history is restored">
        Restored dates: {result.dates} · Photos: {result.photos} · Memories: {result.memories}.
      </Alert>
      <LinkButton href="/dates/history">View your dates</LinkButton>
    </section>
  );

  return (
    <section className="space-y-5 rounded-xl border border-line bg-surface p-5" aria-labelledby="archive-restore-title">
      <div>
        <h2 id="archive-restore-title" className="font-display text-lg font-medium text-ink">Restore your shared history</h2>
        <p className="mt-1 text-sm text-muted">
          Restore into an empty space with the same people and the same owner/partner roles.
          Existing history is never merged or replaced. Deleted items still count as existing content.
        </p>
        <p className="mt-2 text-xs text-muted">Destination: {spaceName || "Your current shared space"}</p>
      </div>
      {blockedReason ? (
        <Alert tone="warning" title="This space isn't available for restore">
          {blockedReason} Use a new empty space with the same people and roles.
          Keep your archive safe before changing your shared space.
        </Alert>
      ) : (
        <>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
            <li>Each partner opens this page and chooses the same portable archive.</li>
            <li>Review the file and approve it. Share your approval code with the person who downloaded it.</li>
            <li>That person enters both approvals here and restores the history within 15 minutes.</li>
          </ol>
          <p className="text-xs text-muted">The file may include the downloader&apos;s private review drafts. Review it before sharing it with your partner.</p>
          <Field label="Portable archive file" htmlFor="archive-file" hint="Choose the JSON file from Download archive above. Maximum 64 MiB.">
            <Input id="archive-file" type="file" accept=".json,application/json" disabled={pending !== null}
              className="h-auto py-2.5 text-sm" aria-describedby="archive-file-hint" onChange={chooseFile} />
          </Field>
        </>
      )}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}
      {pending === "reading" ? <p role="status" className="text-sm text-muted">Reading your archive…</p> : null}
      {selection ? (
        <div className="space-y-5">
          <div className="space-y-2 rounded-lg border border-line bg-paper p-4">
            <h3 className="break-words text-sm font-medium text-ink">File preview: {filename}</h3>
            <p className="break-words text-sm text-muted">{selection.summary.name || "Shared history"}</p>
            <p className="text-sm text-ink">Dates: {selection.summary.dates} · Photos: {selection.summary.photos} · Memories: {selection.summary.memories} · Expenses: {selection.summary.expenses}</p>
            <p className="break-words text-xs text-muted">Downloaded by {selection.summary.exporterEmail} on {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(selection.summary.exportedAt))}</p>
            <p className="break-words text-xs text-muted">People: {selection.summary.members.map((member) => `${member.email} (${member.role === "OWNER" ? "owner" : "partner"})`).join(", ")}</p>
          </div>
          <CheckboxField label="I have reviewed this archive and approve restoring it into this space."
            checked={consented} disabled={pending !== null || Boolean(approval && !expired)} onChange={(event) => setConsented(event.target.checked)} />
          <Button variant="secondary" loading={pending === "approve"}
            disabled={!consented || pending !== null || Boolean(approval && !expired)} onClick={approve}>
            {pending === "approve" ? "Checking archive…" : expired ? "Approve again" : "Approve this archive"}
          </Button>
          {approval ? (
            <div className="space-y-3">
              {expired ? <Alert tone="warning">Your approval expired. Approve again before restoring.</Alert> : null}
              <Field label="Your approval code" htmlFor="archive-approval" hint="Share only with your partner. It expires after 15 minutes and becomes invalid when you sign out.">
                <Textarea id="archive-approval" readOnly value={approval.code} rows={3} spellCheck={false}
                  className="break-all" aria-describedby="archive-approval-hint" onFocus={(event) => event.target.select()} />
              </Field>
              <Button variant="secondary" size="sm" onClick={copyApproval} disabled={expired}>Copy approval code</Button>
            </div>
          ) : null}
          {isExporter ? (
            <div className="space-y-4 border-t border-line pt-5">
              {hasPartner ? (
                <Field label="Partner's approval code" htmlFor="partner-approval" hint="Your partner must approve this same file in this space and stay signed in.">
                  <Textarea id="partner-approval" value={partnerCode} maxLength={4000} rows={3}
                    spellCheck={false} autoCapitalize="none" autoCorrect="off" autoComplete="off"
                    aria-describedby="partner-approval-hint" disabled={pending !== null}
                    onChange={(event) => setPartnerCode(event.target.value)} />
                </Field>
              ) : null}
              <Button loading={pending === "restore"} onClick={restore}
                disabled={!approval || expired || pending !== null || (hasPartner && !partnerCode.trim())}>
                {pending === "restore" ? "Restoring history…" : "Restore archive"}
              </Button>
              <p className="text-xs text-muted">Keep this page open until the restore finishes. Old reminders are restored as dismissed.</p>
            </div>
          ) : (
            <Alert>The person who downloaded this archive must finish the restore. Share your approval code with them.</Alert>
          )}
        </div>
      ) : null}
    </section>
  );
}
