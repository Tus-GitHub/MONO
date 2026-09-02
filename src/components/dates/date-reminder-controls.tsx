"use client";

import { useActionState } from "react";
import Link from "next/link";

import { FormFeedback } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/utils/result";
import {
  clearCustomReminderAction,
  setCustomReminderAction,
} from "@/server/actions/reminders";

function whenLabel(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en", {
      timeZone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

/** Shown on a PLANNED/TODAY date: the automatic reminders, plus one the user can set by hand. */
export function DateReminderControls({
  dateId,
  customReminderIso,
  timeZone,
}: {
  dateId: string;
  customReminderIso: string | null;
  timeZone: string;
}) {
  const [setState, setAction] = useActionState(setCustomReminderAction, idleState);
  const [clearState, clearAction] = useActionState(clearCustomReminderAction, idleState);

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <Icon name="bell" size="sm" className="text-muted" />
        Reminders
      </p>

      <p className="mt-1.5 text-xs text-muted">
        You&apos;ll be nudged the day before and on the morning of the date, unless you&apos;ve
        turned those off in{" "}
        <Link href="/settings/notifications" className="text-primary hover:underline">
          settings
        </Link>
        .
      </p>

      <div className="mt-3 border-t border-line pt-3">
        <FormFeedback state={setState.status !== "idle" ? setState : clearState} />

        {customReminderIso ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink">
              Custom reminder:{" "}
              <span className="font-medium">{whenLabel(customReminderIso, timeZone)}</span>
            </p>
            <form action={clearAction}>
              <input type="hidden" name="dateId" value={dateId} />
              <Button type="submit" variant="ghost" size="sm">
                Clear
              </Button>
            </form>
          </div>
        ) : (
          <form action={setAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="dateId" value={dateId} />
            <label className="flex-1">
              <span className="mb-1 block text-xs font-medium text-muted">
                Add a custom reminder
              </span>
              <Input type="datetime-local" name="at" required className="w-full" />
            </label>
            <SubmitButton variant="secondary" size="sm" pendingText="Setting…">
              Set
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
