"use client";

import { startTransition, useActionState, useState } from "react";
import { DateStatus } from "@prisma/client";

import { FormFeedback } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DATE_STATUS_TRANSITIONS } from "@/lib/date/lifecycle";
import { idleState } from "@/lib/utils/result";
import { transitionDateAction } from "@/server/actions/date";

interface Move {
  to: DateStatus;
  label: string;
  variant?: "primary" | "secondary" | "danger";
  destructive?: boolean;
}

const MOVES: Record<DateStatus, Move[]> = {
  DRAFT: [{ to: DateStatus.PLANNED, label: "Mark as planned" }],
  PLANNED: [
    { to: DateStatus.IN_PROGRESS, label: "Start the date" },
    { to: DateStatus.CANCELLED, label: "Cancel", variant: "danger", destructive: true },
  ],
  TODAY: [
    { to: DateStatus.IN_PROGRESS, label: "Start the date" },
    { to: DateStatus.COMPLETED, label: "Mark completed", variant: "secondary" },
    { to: DateStatus.CANCELLED, label: "Cancel", variant: "danger", destructive: true },
  ],
  IN_PROGRESS: [{ to: DateStatus.COMPLETED, label: "Mark completed" }],
  COMPLETED: [{ to: DateStatus.IN_PROGRESS, label: "Reopen", variant: "secondary" }],
  CANCELLED: [
    { to: DateStatus.PLANNED, label: "Restore plan", variant: "secondary" },
    { to: DateStatus.DRAFT, label: "Restore as draft", variant: "secondary" },
  ],
};

export function StatusControl({
  dateId,
  status,
}: {
  dateId: string;
  status: DateStatus;
}) {
  const confirm = useConfirm();
  const [state, dispatch, isPending] = useActionState(transitionDateAction, idleState);
  const [running, setRunning] = useState<DateStatus | null>(null);

  const allowed = new Set(DATE_STATUS_TRANSITIONS[status]);
  const moves = MOVES[status].filter((move) => allowed.has(move.to));
  if (moves.length === 0) return <FormFeedback state={state} />;

  const run = async (move: Move) => {
    if (isPending) return;
    if (move.destructive) {
      const ok = await confirm({
        title: "Cancel this date?",
        description: "It stays in your history, marked cancelled.",
        confirmLabel: "Cancel date",
        tone: "danger",
      });
      if (!ok) return;
    }
    const fd = new FormData();
    fd.set("dateId", dateId);
    fd.set("to", move.to);
    setRunning(move.to);
    startTransition(() => dispatch(fd));
  };

  return (
    <div className="space-y-2">
      <FormFeedback state={state} />
      <div className="flex flex-wrap gap-2">
        {moves.map((move) => (
          <Button
            key={move.to}
            size="sm"
            variant={move.variant ?? "primary"}
            disabled={isPending}
            loading={isPending && running === move.to}
            onClick={() => run(move)}
          >
            {move.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
