"use client";

import { PendingFields } from "@/components/forms/pending-fields";
import { useActionState, useEffect, useState } from "react";
import { FormFeedback } from "@/components/forms/form-feedback";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/utils/result";
import { requestVerificationAction } from "@/server/actions/email-verification";
import { postEmailVerification } from "@/lib/auth/email-verification-client";
import type { ActionState } from "@/lib/utils/result";

interface VerificationProps { currentEmail?: string; alreadyVerified: boolean; invitationPath?: string | null }

export function EmailVerificationForm(props: VerificationProps) {
  const [token, setToken] = useState("");
  useEffect(() => {
    let active = true;
    const readFragment = () => {
      if (!active) return;
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      setToken(fragment.get("token") ?? "");
      if (window.location.hash) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    };
    window.addEventListener("hashchange", readFragment);
    queueMicrotask(readFragment);
    return () => { active = false; window.removeEventListener("hashchange", readFragment); };
  }, []);
  // A second email link in the same tab must not inherit the first link's success state.
  return <VerificationDetails key={token} token={token} {...props} />;
}

function VerificationDetails({ token, currentEmail, alreadyVerified, invitationPath }: VerificationProps & { token: string }) {
  const [verifyState, verifyAction] = useActionState(async (_previous: ActionState, form: FormData) =>
    postEmailVerification({ action: "confirm", token: String(form.get("token") ?? "") }), idleState);
  const [resendState, resendAction] = useActionState(requestVerificationAction, idleState);
  const confirmed = verifyState.status === "success";
  const continueHref = invitationPath ?? (currentEmail ? "/onboarding" : "/login");
  const continueLabel = invitationPath ? "Return to your invitation" : currentEmail ? "Continue to MONO" : "Sign in to MONO";
  if (confirmed || (alreadyVerified && !token)) return (
    <div className="space-y-5">
      <Alert tone="success" title="Email confirmed">Your email address is confirmed. You&apos;re ready to continue your story.</Alert>
      <LinkButton href={continueHref}>{continueLabel}</LinkButton>
    </div>
  );
  return (
    <div className="space-y-6">
      {token ? (
        <form action={verifyAction} className="space-y-4">
          <PendingFields className="space-y-4">
            <p className="text-sm text-muted">Confirm the email address that received this link. This won&apos;t change your password or sign you in.</p>
            <input type="hidden" name="token" value={token} />
            <FormFeedback state={verifyState} />
            <SubmitButton fullWidth pendingText="Confirming…">Verify email address</SubmitButton>
          </PendingFields>
        </form>
      ) : (
        <Alert title="Check your inbox">Open the verification email from MONO to confirm your address before creating or joining a space. If you came from an invitation, return to that tab after confirming.</Alert>
      )}
      <form action={resendAction} className="space-y-4 border-t border-line pt-5" noValidate>
        <PendingFields className="space-y-4">
          <div>
            <h2 className="text-sm font-medium text-ink">Need a new link?</h2>
            <p className="mt-1 text-xs text-muted">Links last 24 hours. Check your spam folder too. Older unexpired links remain usable after a resend.</p>
          </div>
          <FormFeedback state={resendState} />
          <Field label="Email address" htmlFor="verification-email" errors={resendState.status === "error" ? resendState.fieldErrors?.email : undefined}>
            <Input id="verification-email" name="email" type="email" autoComplete="email" defaultValue={currentEmail ?? ""} required />
          </Field>
          <SubmitButton variant="secondary" fullWidth pendingText="Sending…">Resend verification email</SubmitButton>
        </PendingFields>
      </form>
      <LinkButton href={continueHref} variant="link">{invitationPath ? "Return to your invitation" : currentEmail ? "Continue to MONO" : "Back to sign in"}</LinkButton>
    </div>
  );
}
