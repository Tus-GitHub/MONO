"use client";

import { useActionState, useEffect } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InputGroup } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { idleState } from "@/lib/utils/result";
import {
  generateInvitationAction,
  revokeInvitationAction,
} from "@/server/actions/couple";

interface Props {
  activeInvitation: { id: string; expiresAt: string } | null;
}

function formatExpiry(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const hours = Math.round(ms / 3_600_000);
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  return `in ${Math.round(hours / 24)} day${Math.round(hours / 24) === 1 ? "" : "s"}`;
}

export function InvitationManager({ activeInvitation }: Props) {
  const { toast } = useToast();
  const [genState, generate] = useActionState(generateInvitationAction, idleState);
  const [revokeState, revoke] = useActionState(revokeInvitationAction, idleState);

  // The raw link only exists right after generation (it is never stored server-side).
  const link = genState.status === "success" ? (genState.data?.url ?? null) : null;

  useEffect(() => {
    if (link) {
      try {
        sessionStorage.setItem("mono:lastInvite", link);
      } catch {
        /* storage may be unavailable */
      }
    }
  }, [link]);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Invitation link copied", variant: "success" });
    } catch {
      toast({ title: "Couldn't copy", description: "Select and copy it manually.", variant: "error" });
    }
  };

  const share = async () => {
    if (!link) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Join me on MONO",
          text: "Our private space for two — accept my invitation:",
          url: link,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      copy();
    }
  };

  return (
    <div className="space-y-4">
      <FormFeedback state={genState} />
      <FormFeedback state={revokeState} />

      {activeInvitation ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm">
          <span className="flex items-center gap-2 text-muted">
            <span className="size-2 rounded-full bg-success" />
            Invitation active · expires {formatExpiry(activeInvitation.expiresAt)}
          </span>
          <form action={revoke}>
            <input type="hidden" name="id" value={activeInvitation.id} />
            <button
              type="submit"
              className="text-xs font-medium text-muted transition-colors hover:text-error"
            >
              Cancel
            </button>
          </form>
        </div>
      ) : null}

      {link ? (
        <div className="space-y-2">
          <InputGroup className="px-3" leading={<Icon name="link" size="sm" />}>
            <input
              readOnly
              value={link}
              onFocus={(event) => event.currentTarget.select()}
              className="h-11 w-full bg-transparent text-sm text-ink focus:outline-none"
            />
          </InputGroup>
          <div className="flex gap-2">
            <Button size="sm" onClick={copy} leadingIcon={<Icon name="copy" size="sm" />}>
              Copy
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={share}
              leadingIcon={<Icon name="share" size="sm" />}
            >
              Share
            </Button>
          </div>
        </div>
      ) : null}

      <form action={generate}>
        <SubmitButton
          variant={link || activeInvitation ? "secondary" : "primary"}
          pendingText="Creating link…"
          leadingIcon={<Icon name="refresh" size="sm" />}
        >
          {link || activeInvitation ? "Generate a fresh link" : "Create an invitation link"}
        </SubmitButton>
      </form>
      <p className="text-xs text-muted">
        Links are single-use and expire. Only the person you send it to can join.
      </p>
    </div>
  );
}
