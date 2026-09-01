"use client";

import { useActionState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { CheckboxField } from "@/components/ui/checkbox";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/utils/result";
import { updateNotificationPrefsAction } from "@/server/actions/reminders";
import type { NotificationPrefs } from "@/server/services/notification-preference-service";

const ROWS: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  { key: "upcomingDate", label: "Upcoming date", hint: "The day before a planned date." },
  { key: "dateDay", label: "Date day", hint: "On the morning of the date." },
  { key: "reviewReminder", label: "Review reminder", hint: "After a date, to add your review." },
  { key: "unfinishedPlan", label: "Unfinished plan", hint: "A draft you haven't finished." },
  { key: "partnerEdits", label: "Partner edits", hint: "When your partner changes a shared plan." },
];

export function NotificationSettingsForm({ initial }: { initial: NotificationPrefs }) {
  const [state, action] = useActionState(updateNotificationPrefsAction, idleState);

  return (
    <form action={action} className="space-y-4">
      <FormFeedback state={state} />
      <div className="divide-y divide-line rounded-xl border border-line bg-surface">
        {ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-ink">{row.label}</p>
              <p className="text-xs text-muted">{row.hint}</p>
            </div>
            <CheckboxField
              name={row.key}
              defaultChecked={initial[row.key]}
              label=""
              className="shrink-0"
            />
          </div>
        ))}
      </div>
      <SubmitButton pendingText="Saving…">Save preferences</SubmitButton>
    </form>
  );
}
