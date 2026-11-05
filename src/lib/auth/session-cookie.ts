import "server-only";

import { cookies, headers } from "next/headers";
import { createAuthSession } from "@/lib/auth/session-store";

import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
  signSession,
  type SessionPayload,
} from "@/lib/auth/session";

/**
 * Reads/writes the session cookie via `next/headers`. `set`/`clear` only work inside a
 * Server Action or Route Handler — never during a Server Component render.
 */
export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value ?? null;
}

/**
 * @param remember `true` (default) → persistent 30-day cookie; `false` → browser-session
 * cookie that clears when the browser closes ("remember me" unchecked).
 */
export async function writeSessionCookie(
  payload: Pick<SessionPayload, "userId" | "tokenVersion">,
  remember = true,
): Promise<void> {
  const store = await cookies();
  const session = await createAuthSession(payload, remember, (await headers()).get("user-agent"), store.get("mono_push_device")?.value);
  const token = await signSession({ ...payload, sessionId: session.id }, remember);
  store.set(
    SESSION_COOKIE_NAME,
    token,
    sessionCookieOptions(remember ? SESSION_MAX_AGE_SECONDS : undefined),
  );
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, "", sessionCookieOptions(0));
}
