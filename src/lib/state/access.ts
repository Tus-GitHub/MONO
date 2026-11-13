type Timestamp = Date | string | null;
const millis = (value: Date | string) => new Date(value).getTime();

export type CapabilityState = "available" | "consumed" | "revoked" | "expired";
export function capabilityState(input: { expiresAt: Date | string; usedAt?: Timestamp; revokedAt?: Timestamp }, now = new Date()): CapabilityState {
  if (input.usedAt) return "consumed";
  if (input.revokedAt) return "revoked";
  return millis(input.expiresAt) <= now.getTime() ? "expired" : "available";
}

export type SessionState = "active" | "revoked" | "expired" | "invalidated";
export function sessionState(input: { expiresAt: Date; revokedAt: Date | null; tokenVersion: number; user: { deletedAt?: Date | null; tokenVersion: number } }, now = new Date()): SessionState {
  if (input.user.deletedAt || input.tokenVersion !== input.user.tokenVersion) return "invalidated";
  if (input.revokedAt) return "revoked";
  return input.expiresAt <= now ? "expired" : "active";
}

export function coupleState(input: { status: "PENDING" | "ACTIVE" | "ARCHIVED"; deletedAt: Date | null }): "pending" | "active" | "archived" | "deleted" {
  return input.deletedAt ? "deleted" : input.status === "ARCHIVED" ? "archived" : input.status === "ACTIVE" ? "active" : "pending";
}
