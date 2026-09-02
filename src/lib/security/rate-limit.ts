import "server-only";

import { headers } from "next/headers";

/**
 * Best-effort, in-process sliding-window rate limiter.
 *
 * This is per server instance, not a shared store — on a multi-instance deployment each box
 * keeps its own counters. It is deliberately lightweight: enough to blunt credential stuffing,
 * invite-code guessing and password-reset spam from a single source without adding a Redis
 * dependency. Swap `rateLimit` for a durable backend if the threat model grows.
 */

const HITS = new Map<string, number[]>();
let lastSweep = 0;

function sweep(now: number): void {
  for (const [key, times] of HITS) {
    const live = times.filter((t) => now - t < 3_600_000);
    if (live.length === 0) HITS.delete(key);
    else HITS.set(key, live);
  }
}

/** A per-request identity for a limiter tag: the client IP behind the proxy, plus the tag. */
export async function clientKey(tag: string): Promise<string> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "unknown";
  return `${tag}:${ip}`;
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    sweep(now);
    lastSweep = now;
  }
  const times = (HITS.get(key) ?? []).filter((t) => now - t < windowMs);
  if (times.length >= limit) {
    HITS.set(key, times);
    return { ok: false, retryAfterSec: Math.ceil((windowMs - (now - times[0])) / 1000) };
  }
  times.push(now);
  HITS.set(key, times);
  return { ok: true, retryAfterSec: 0 };
}

/**
 * Check the limiter for the current request. Returns `null` when the call is allowed, or a
 * user-facing message when it should be refused.
 */
export async function checkRateLimit(
  tag: string,
  limit: number,
  windowMs: number,
): Promise<string | null> {
  const result = rateLimit(await clientKey(tag), limit, windowMs);
  if (result.ok) return null;
  const wait =
    result.retryAfterSec > 60
      ? `${Math.ceil(result.retryAfterSec / 60)} minutes`
      : `${result.retryAfterSec} seconds`;
  return `Too many attempts. Please try again in about ${wait}.`;
}

export const MINUTE = 60_000;
