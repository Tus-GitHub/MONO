"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ActionFeedback } from "@/components/forms/action-feedback";
import { reportCategories } from "@/lib/validation/moderation";
import { idleState } from "@/lib/utils/result";
import { submitReportAction } from "@/server/actions/moderation";

export function ReportAccountForm({ accounts }: { accounts: { id: string }[] }) {
  const [state, action, pending] = useActionState(submitReportAction, idleState);
  if (state.status === "success") return <ActionFeedback state={state} />;
  if (!accounts.length) return <p className="text-sm text-muted">You can report an account after sharing a space with them.</p>;
  return <form action={action} className="space-y-4 rounded-xl border border-line bg-surface p-5">
    <p className="text-sm text-muted">Only your account ID, the reported account ID and the details you submit here go to the admin. Private chats and photos are not attached. Your partner is not notified of this report.</p>
    <fieldset disabled={pending} className="space-y-3">
      <label htmlFor="report-account" className="block text-sm text-ink">Account you shared a space with</label>
      <Select id="report-account" name="targetId" required>{accounts.map((account) => <option key={account.id} value={account.id}>{account.id}</option>)}</Select>
      <label htmlFor="report-category" className="block text-sm text-ink">Reason</label>
      <Select id="report-category" name="category" defaultValue="" required><option value="" disabled>Select a reason</option>{reportCategories.map((category) => <option key={category}>{category}</option>)}</Select>
      <label htmlFor="report-details" className="block text-sm text-ink">What happened?</label>
      <Textarea id="report-details" name="details" required minLength={10} maxLength={2000} placeholder="Share only the information you want the admin to review." />
      <Button type="submit" loading={pending}>Send report for review</Button>
    </fieldset>
    <ActionFeedback state={state} />
  </form>;
}
