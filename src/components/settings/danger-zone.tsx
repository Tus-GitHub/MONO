"use client";

import { startTransition, useActionState, useState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { idleState } from "@/lib/utils/result";
import { deleteAccountAction, disconnectPartnerAction } from "@/server/actions/settings";

export function DangerZone({
  hasPartner,
  partnerName,
}: {
  hasPartner: boolean;
  partnerName: string | null;
}) {
  const confirm = useConfirm();
  const [dcState, dcDispatch] = useActionState(disconnectPartnerAction, idleState);
  const [delState, delAction] = useActionState(deleteAccountAction, idleState);
  const [showDelete, setShowDelete] = useState(false);

  async function onDisconnect() {
    const ok = await confirm({
      title: hasPartner
        ? `Disconnect from ${partnerName ?? "your partner"}?`
        : "Archive this space?",
      description:
        "The shared space is archived and you both go back to a fresh start. Nothing is deleted — every date, memory and photo is kept and can be restored by support.",
      confirmLabel: "Disconnect",
      tone: "danger",
    });
    if (!ok) return;
    startTransition(() => dcDispatch(new FormData()));
  }

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-medium text-error">Account</h2>

      <div className="rounded-xl border border-error/30 bg-error-tint/40 p-5">
        <p className="text-sm font-medium text-ink">
          {hasPartner ? "Disconnect partner" : "Archive shared space"}
        </p>
        <p className="mt-1 text-sm text-muted">
          Ends the connection and archives everything you&apos;ve made together. Reversible by
          support, not from here.
        </p>
        <FormFeedback state={dcState} />
        <Button variant="danger" size="sm" className="mt-4" onClick={onDisconnect}>
          {hasPartner ? "Disconnect…" : "Archive…"}
        </Button>
      </div>

      <div className="rounded-xl border border-error/30 bg-error-tint/40 p-5">
        <p className="text-sm font-medium text-ink">Delete account</p>
        <p className="mt-1 text-sm text-muted">
          Closes your account and signs you out everywhere. Your shared space is archived too.
        </p>

        {showDelete ? (
          <form action={delAction} className="mt-4 space-y-3">
            <FormFeedback state={delState} />
            <label htmlFor="confirm" className="block text-xs font-medium text-muted">
              Type <span className="font-semibold text-ink">DELETE</span> to confirm
            </label>
            <Input id="confirm" name="confirm" autoComplete="off" placeholder="DELETE" required />
            <div className="flex gap-2">
              <SubmitButton variant="danger" size="sm" pendingText="Deleting…">
                Delete my account
              </SubmitButton>
              <Button variant="ghost" size="sm" onClick={() => setShowDelete(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="danger"
            size="sm"
            className="mt-4"
            onClick={() => setShowDelete(true)}
          >
            Delete account…
          </Button>
        )}
      </div>
    </section>
  );
}
