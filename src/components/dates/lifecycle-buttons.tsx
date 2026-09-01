"use client";

import { startTransition, useActionState } from "react";
import { DateStatus } from "@prisma/client";

import { FormFeedback } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { idleState } from "@/lib/utils/result";
import { transitionDateAction } from "@/server/actions/date";

function useTransition(dateId: string, to: DateStatus) {
  const [state, dispatch] = useActionState(transitionDateAction, idleState);
  const run = () => {
    const fd = new FormData();
    fd.set("dateId", dateId);
    fd.set("to", to);
    startTransition(() => dispatch(fd));
  };
  return { state, run };
}

/** The big "we're on the date now" action. */
export function StartDateButton({
  dateId,
  fullWidth = true,
}: {
  dateId: string;
  fullWidth?: boolean;
}) {
  const { state, run } = useTransition(dateId, DateStatus.IN_PROGRESS);
  return (
    <div className="space-y-2">
      <Button
        size="lg"
        fullWidth={fullWidth}
        onClick={run}
        leadingIcon={<Icon name="sparkles" size="sm" />}
      >
        Start the date
      </Button>
      <FormFeedback state={state} />
    </div>
  );
}

/** Wrap up. Reassures that nothing locks — the recap, photos and reviews stay open after. */
export function CompleteDateButton({
  dateId,
  fullWidth = true,
  variant = "primary",
}: {
  dateId: string;
  fullWidth?: boolean;
  variant?: "primary" | "secondary";
}) {
  const confirm = useConfirm();
  const { state, run } = useTransition(dateId, DateStatus.COMPLETED);

  const onClick = async () => {
    const ok = await confirm({
      title: "Mark this date completed?",
      description:
        "It moves to your history. You can still add photos, record what happened, write reviews and keep a memory afterwards — nothing locks.",
      confirmLabel: "Complete date",
    });
    if (ok) run();
  };

  return (
    <div className="space-y-2">
      <Button
        size="lg"
        variant={variant}
        fullWidth={fullWidth}
        onClick={onClick}
        leadingIcon={<Icon name="checkCircle" size="sm" />}
      >
        Complete date
      </Button>
      <FormFeedback state={state} />
    </div>
  );
}
