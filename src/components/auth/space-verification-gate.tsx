"use client";

import { startTransition, useActionState, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormFeedback } from "@/components/forms/form-feedback";
import { idleState } from "@/lib/utils/result";
import { checkOwnVerificationAction, resendOwnVerificationAction, rememberOwnInvitationAction } from "@/server/actions/email-verification";

/** Keep the invite URL and entered code in place while mailbox confirmation happens in another tab. */
export function SpaceVerificationGate({ verified, email, invitationToken, children }: {
  verified: boolean; email: string; invitationToken?: string; children: ReactNode;
}) {
  const invitation = Boolean(invitationToken);
  const [open, setOpen] = useState(invitation);
  const [checkState, checkAction] = useActionState(checkOwnVerificationAction, idleState);
  const [resendState, resendAction] = useActionState(resendOwnVerificationAction, idleState);
  const router = useRouter();

  useEffect(() => {
    if (invitationToken) startTransition(() => {
      void rememberOwnInvitationAction(invitationToken).catch(() => {});
    });
  }, [invitationToken]);

  useEffect(() => {
    if (checkState.status === "success") router.refresh();
  }, [checkState, router]);

  return (
    <>
      {!verified ? (
        <Alert title="Verify your email to connect" className="mb-4">
          Confirm your email before creating or joining a private space.{" "}
          <Button variant="link" onClick={() => setOpen(true)}>Verify email to continue</Button>
        </Alert>
      ) : null}
      <div onSubmitCapture={(event) => {
        if (!verified) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }
      }}>{children}</div>
      <Modal open={!verified && open} onClose={() => setOpen(false)} size="sm"
        title="Verify your email first"
        description="Confirm your address to keep your shared space private.">
        <div className="space-y-5">
          <p className="text-sm text-muted">
            We sent a verification email to <strong className="break-all text-ink">{email}</strong>.
            Open it and choose Verify email address on the confirmation page. Check Spam or Junk too.
          </p>
          <p className="text-sm text-muted">
            {invitation ? "Your invitation stays on this page and won't be used until you accept it after verification." : "Your details stay on this page while you check your email."}
            {" "}Come back here when you&apos;re done.
          </p>
          <form action={checkAction} className="space-y-3">
            <FormFeedback state={checkState} />
            <SubmitButton fullWidth pendingText="Checking…">I&apos;ve verified — continue</SubmitButton>
          </form>
          <form action={resendAction} className="space-y-3">
            <FormFeedback state={resendState} />
            <SubmitButton variant="secondary" fullWidth pendingText="Sending…">Resend verification email</SubmitButton>
          </form>
          <p className="text-xs text-faint">Links last 24 hours. Allow a minute before requesting another email.</p>
        </div>
      </Modal>
    </>
  );
}
