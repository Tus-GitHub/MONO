import { MAX_ATTEMPTS } from "@/lib/jobs/retry";

export type CleanupStage = "scheduled" | "ready" | "processing" | "failed";
export function cleanupStage(job: { failedAt: Date | null; attempts: number; leaseUntil: Date | null; nextAttemptAt: Date }, now = new Date()): CleanupStage {
  if (job.failedAt || (job.attempts >= MAX_ATTEMPTS && (!job.leaseUntil || job.leaseUntil <= now))) return "failed";
  if (job.leaseUntil && job.leaseUntil > now) return "processing";
  return job.nextAttemptAt > now ? "scheduled" : "ready";
}

export type DeliveryStage = "PENDING" | "PROCESSING" | "DELIVERED" | "CANCELLED" | "FAILED";
export const DELIVERY_TRANSITIONS: Record<DeliveryStage, readonly DeliveryStage[]> = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["PROCESSING", "PENDING", "DELIVERED", "CANCELLED", "FAILED"],
  DELIVERED: [], CANCELLED: [], FAILED: [],
};
export function deliveryOutcome(attempts: number): "PENDING" | "FAILED" {
  return attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING";
}
