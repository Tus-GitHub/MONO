"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RevisitChoice } from "@prisma/client";

import { FormFeedback } from "@/components/forms/form-feedback";
import { Icon } from "@/components/ui/icon";
import { Input, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/utils/result";
import { cn } from "@/lib/utils/cn";
import { saveRevisitAction } from "@/server/actions/post-date";

const OPTIONS: { value: RevisitChoice; label: string; sub: string }[] = [
  { value: "YES", label: "Yes", sub: "We'd go again" },
  { value: "MAYBE", label: "Maybe", sub: "Under the right mood" },
  { value: "NO", label: "No", sub: "Done this one" },
];

export function RevisitControl({
  dateId,
  revisit,
}: {
  dateId: string;
  revisit: { choice: RevisitChoice; reason: string | null; targetTimeframe: string | null } | null;
}) {
  const router = useRouter();
  const [state, action] = useActionState(saveRevisitAction, idleState);
  const [choice, setChoice] = useState<RevisitChoice | "">(revisit?.choice ?? "");

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="dateId" value={dateId} />
      <input type="hidden" name="choice" value={choice} />

      <FormFeedback state={state} />

      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={choice === option.value}
            onClick={() => setChoice(option.value)}
            className={cn(
              "rounded-xl border px-3 py-3 text-center transition-colors",
              choice === option.value
                ? "border-primary bg-primary-tint text-primary"
                : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink",
            )}
          >
            <span className="block text-sm font-medium">{option.label}</span>
            <span className="mt-0.5 block text-2xs">{option.sub}</span>
          </button>
        ))}
      </div>

      {choice ? (
        <>
          <Textarea
            name="reason"
            rows={2}
            defaultValue={revisit?.reason ?? ""}
            placeholder={choice === "NO" ? "What put you off?" : "What made it worth another go?"}
          />
          {choice !== "NO" ? (
            <Input
              name="targetTimeframe"
              defaultValue={revisit?.targetTimeframe ?? ""}
              placeholder="When? e.g. this summer, next date night"
            />
          ) : null}
          <div className="flex items-center gap-2">
            <SubmitButton size="sm" pendingText="Saving…">
              {revisit ? "Update" : "Save"}
            </SubmitButton>
            {revisit ? (
              <span className="inline-flex items-center gap-1 text-xs text-success">
                <Icon name="check" size={13} />
                Decided
              </span>
            ) : null}
          </div>
        </>
      ) : null}
    </form>
  );
}
