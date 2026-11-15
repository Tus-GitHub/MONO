"use client";

import { useActionState } from "react";
import { adminLoginAction } from "@/server/actions/admin-auth";
import { idleState } from "@/lib/utils/result";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/forms/action-feedback";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(adminLoginAction, idleState);
  return <form action={action} className="space-y-4">
    <fieldset disabled={pending} className="space-y-3">
      <label htmlFor="admin-email" className="block text-sm text-ink">Admin sign-in email</label>
      <Input id="admin-email" name="email" type="email" autoComplete="username" required placeholder="Admin email or sign-in alias" maxLength={320} />
      <label htmlFor="admin-password" className="block text-sm text-ink">Password</label>
      <PasswordInput id="admin-password" name="password" autoComplete="current-password" required maxLength={200} />
      <Button type="submit" fullWidth loading={pending}>Sign in to admin</Button>
    </fieldset>
    <ActionFeedback state={state} />
  </form>;
}
