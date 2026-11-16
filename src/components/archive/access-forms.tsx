"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { idleState } from "@/lib/utils/result";
import { requestArchiveAction, reviewArchiveAction } from "@/server/actions/archive-access";

export function ArchiveRequestForm({ coupleId }: { coupleId: string }) {
  const [state, action, pending] = useActionState(requestArchiveAction, idleState);
  return <form action={action} className="space-y-2"><input type="hidden" name="coupleId" value={coupleId} />
    <Button type="submit" loading={pending}>Request access</Button>
    {state.status !== "idle" ? <p role={state.status === "error" ? "alert" : "status"} className={`text-sm ${state.status === "error" ? "text-error" : "text-muted"}`}>{state.message}</p> : null}
  </form>;
}

export function ArchiveReviewForm({ requestId, status, eligible }: { requestId: string; status: string; eligible: boolean }) {
  const [state, action, pending] = useActionState(reviewArchiveAction, idleState);
  return <form action={action} className="space-y-2"><input type="hidden" name="requestId" value={requestId} />
    <div className="flex flex-wrap gap-2">
      {status !== "APPROVED" ? <Button type="submit" name="action" value="APPROVED" disabled={!eligible || pending}>Approve access</Button> : <Button type="submit" name="action" value="REVOKED" variant="danger" loading={pending}>Revoke access</Button>}
      {status === "PENDING" ? <Button type="submit" name="action" value="DENIED" variant="secondary" disabled={pending}>Deny request</Button> : null}
    </div>
    {!eligible ? <p className="text-xs text-muted">This account is no longer eligible for access.</p> : null}
    {state.status !== "idle" ? <p role={state.status === "error" ? "alert" : "status"} className={`text-sm ${state.status === "error" ? "text-error" : "text-muted"}`}>{state.message}</p> : null}
  </form>;
}
