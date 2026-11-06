"use client";

import { useActionState, useId } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { CheckboxField } from "@/components/ui/checkbox";
import { SubmitButton } from "@/components/ui/submit-button";
import { CATEGORY_META, NOTIFICATION_CATEGORIES } from "@/lib/notifications/prefs";
import { idleState } from "@/lib/utils/result";
import { updateNotificationPrefsAction } from "@/server/actions/reminders";
import type { NotificationPrefs } from "@/server/services/notification-preference-service";

export function NotificationSettingsForm({ initial }: { initial: NotificationPrefs }) {
  const [state, action] = useActionState(updateNotificationPrefsAction, idleState);
  const groupId = useId();

  return (
    <form action={action} className="space-y-4">
      <FormFeedback state={state} />
      <div className="divide-y divide-line rounded-xl border border-line bg-surface">
        {NOTIFICATION_CATEGORIES.map((key) => (
          <div key={key} className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <p id={`${groupId}-${key}-label`} className="text-sm font-medium text-ink">{CATEGORY_META[key].label}</p>
              <p id={`${groupId}-${key}-hint`} className="text-xs text-muted">{CATEGORY_META[key].hint}</p>
            </div>
            <CheckboxField
              name={key}
              defaultChecked={initial[key]}
              label=""
              aria-labelledby={`${groupId}-${key}-label`}
              aria-describedby={`${groupId}-${key}-hint`}
              className="shrink-0"
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">
        These are your settings only. Turning one off stops that kind of nudge for you — your
        partner keeps theirs.
      </p>
      <SubmitButton pendingText="Saving…">Save preferences</SubmitButton>
    </form>
  );
}
