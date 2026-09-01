"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";

/** Shows the couple invite code with a copy affordance. */
export function InviteCodeCard({ code }: { code: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast({ title: "Invite code copied", variant: "success" });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't copy", description: "Copy it manually instead.", variant: "error" });
    }
  };

  return (
    <div className="rounded-xl border border-primary/25 bg-primary-tint/50 p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-fg">
          <Icon name="users" size="sm" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-medium text-ink">Invite your partner</h3>
          <p className="mt-1 text-sm text-muted">
            Share this code so they can join your space.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="rounded-lg border border-line bg-elevated px-3 py-2 font-mono text-base tracking-[0.2em] text-ink">
              {code}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={copy}
              leadingIcon={<Icon name={copied ? "check" : "copy"} size="sm" />}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
