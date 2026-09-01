"use client";

import { useActionState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { Icon } from "@/components/ui/icon";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/utils/result";
import { acceptInvitationAction } from "@/server/actions/couple";

export function AcceptInvitationButton({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvitationAction, idleState);

  return (
    <form action={action} className="space-y-3">
      <FormFeedback state={state} />
      <input type="hidden" name="token" value={token} />
      <SubmitButton
        fullWidth
        size="lg"
        pendingText="Connecting…"
        trailingIcon={<Icon name="arrowRight" size="sm" />}
      >
        Accept &amp; connect
      </SubmitButton>
    </form>
  );
}
