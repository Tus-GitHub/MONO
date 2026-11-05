/** Bounded retry policy shared by delivery and cleanup workers. */
export const MAX_ATTEMPTS = 6;
export const LEASE_MS = 2 * 60_000;
export function retryAt(attempt: number, now = new Date()): Date {
  const minutes = [1, 5, 15, 60, 360][Math.min(Math.max(attempt - 1, 0), 4)];
  return new Date(now.getTime() + minutes * 60_000);
}
