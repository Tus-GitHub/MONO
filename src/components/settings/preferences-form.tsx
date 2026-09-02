"use client";

import { useActionState, useState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { CheckboxField } from "@/components/ui/checkbox";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils/cn";
import { idleState } from "@/lib/utils/result";
import {
  THEMES,
  THEME_HINT,
  THEME_LABEL,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/settings/theme";
import { updateUserSettingsAction } from "@/server/actions/settings";
import type { UserSettings } from "@/server/services/user-settings-service";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  try {
    if (theme === "light" || theme === "dark") {
      root.setAttribute("data-theme", theme);
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } else {
      root.removeAttribute("data-theme");
      localStorage.removeItem(THEME_STORAGE_KEY);
    }
  } catch {
    /* storage blocked — the attribute change already took effect */
  }
}

export function PreferencesForm({ initial }: { initial: UserSettings }) {
  const [state, action] = useActionState(updateUserSettingsAction, idleState);
  const [theme, setTheme] = useState<Theme>(initial.theme);

  return (
    <form action={action} className="space-y-6">
      <FormFeedback state={state} />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">Theme</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {THEMES.map((option) => (
            <label
              key={option}
              className={cn(
                "cursor-pointer rounded-lg border p-3 transition-colors",
                theme === option
                  ? "border-primary bg-primary-tint/50"
                  : "border-line bg-surface hover:border-line-strong",
              )}
            >
              <input
                type="radio"
                name="theme"
                value={option}
                checked={theme === option}
                onChange={() => {
                  setTheme(option);
                  applyTheme(option);
                }}
                className="sr-only"
              />
              <span className="block text-sm font-medium text-ink">{THEME_LABEL[option]}</span>
              <span className="mt-0.5 block text-2xs text-muted">{THEME_HINT[option]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-ink">Privacy</legend>
        <div className="divide-y divide-line rounded-xl border border-line bg-surface">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-ink">Hide money figures</p>
              <p className="text-xs text-muted">
                Blank out spend totals and value insights on the couple profile.
              </p>
            </div>
            <CheckboxField
              name="hideMoneyInsights"
              defaultChecked={initial.hideMoneyInsights}
              label=""
              className="shrink-0"
            />
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-ink">Hide individual preference breakdown</p>
              <p className="text-xs text-muted">
                Show only the shared averages — no per-person dots or difference notes.
              </p>
            </div>
            <CheckboxField
              name="hidePartnerPreferenceGap"
              defaultChecked={initial.hidePartnerPreferenceGap}
              label=""
              className="shrink-0"
            />
          </div>
        </div>
      </fieldset>

      <SubmitButton pendingText="Saving…">Save preferences</SubmitButton>
    </form>
  );
}
