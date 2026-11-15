"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { moderateAccountAction, reviewReportAction } from "@/server/actions/moderation";
import { idleState } from "@/lib/utils/result";
import { ActionFeedback } from "@/components/forms/action-feedback";

export function ModerationForm({ targetId, deleted, blocked }: { targetId: string; deleted: boolean; blocked: boolean }) {
  const [state, action, pending] = useActionState(moderateAccountAction, idleState);
  const id = useId();
  return <details className="rounded-lg border border-line p-3">
    <summary className="cursor-pointer text-sm font-medium text-ink">Review account action</summary>
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="targetId" value={targetId} />
      <p className="text-sm text-muted">Deleting disables the account and archives its shared space. The partner&apos;s account stays active. Shared history is retained. Block the email separately to prevent re-registration.</p>
      <p className="text-sm text-muted">Blocking signs out accounts using this email and prevents new password or Google signups. Unblocking does not restore deleted accounts or old sessions.</p>
      <fieldset disabled={pending} className="space-y-3">
        <label htmlFor={`${id}-action`} className="block text-sm text-ink">Action</label>
        <Select id={`${id}-action`} name="action" required defaultValue="">
          <option value="" disabled>Choose after reviewing</option>
          {!deleted ? <option value="DELETE">Delete account</option> : null}
          <option value={blocked ? "UNBLOCK_EMAIL" : "BLOCK_EMAIL"}>{blocked ? "Unblock linked email" : "Block linked email"}</option>
        </Select>
        <label htmlFor={`${id}-reason`} className="block text-sm text-ink">Reason for your decision</label>
        <Textarea id={`${id}-reason`} name="reason" required minLength={10} maxLength={1000} />
        <label htmlFor={`${id}-confirmation`} className="block text-sm text-ink">Type account ID to confirm: <span className="break-all font-mono">{targetId}</span></label>
        <Input id={`${id}-confirmation`} name="confirmation" required autoComplete="off" spellCheck={false} />
        <Button type="submit" variant="danger" loading={pending}>Confirm account action</Button>
      </fieldset>
      <ActionFeedback state={state} />
    </form>
  </details>;
}

export function ReportReviewForm({ reportId }: { reportId: string }) {
  const [state, action, pending] = useActionState(reviewReportAction, idleState);
  const id = useId();
  return <form action={action} className="space-y-3">
    <input type="hidden" name="reportId" value={reportId} />
    <fieldset disabled={pending} className="space-y-3">
      <label htmlFor={`${id}-status`} className="block text-sm text-ink">Review outcome</label>
      <Select id={`${id}-status`} name="status" defaultValue="" required>
        <option value="" disabled>Choose after reviewing</option>
        <option value="DISMISSED">Dismiss report</option>
        <option value="ACTIONED">Account action taken</option>
      </Select>
      <label htmlFor={`${id}-review`} className="block text-sm text-ink">Review notes</label>
      <Textarea id={`${id}-review`} name="reason" required minLength={10} maxLength={1000} />
      <Button type="submit" variant="secondary" loading={pending}>Save review</Button>
    </fieldset>
    <ActionFeedback state={state} />
  </form>;
}
