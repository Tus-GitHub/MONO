export interface RestoreApproval { code: string; digest: string; expiresAt: number }
export type RestoreStage = "empty" | "preview" | "approved" | "expired" | "blocked" | "restored";
export function restoreStage(input: { selectedDigest: string | null; approval: RestoreApproval | null; blocked: boolean; restored: boolean }, now = Date.now()): RestoreStage {
  if (input.restored) return "restored";
  if (input.blocked) return "blocked";
  if (!input.selectedDigest) return "empty";
  if (!input.approval || input.approval.digest !== input.selectedDigest) return "preview";
  return input.approval.expiresAt <= now ? "expired" : "approved";
}

export function canRestoreArchive(input: { stage: RestoreStage; isExporter: boolean; hasPartner: boolean; partnerCode: string; consented: boolean }): boolean {
  return input.stage === "approved" && input.isExporter && input.consented && (!input.hasPartner || input.partnerCode.trim().length > 0);
}
