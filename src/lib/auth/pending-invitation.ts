import "server-only";

import { cookies } from "next/headers";
import { isProduction } from "@/config/env";

const COOKIE = "mono_pending_invitation";
export const validInvitationToken = (token: unknown): token is string =>
  typeof token === "string" && /^[A-Za-z0-9_-]{10,200}$/.test(token);

/** A navigation hint bound to this account, never evidence of permission to join. */
export async function rememberInvitation(userId: string, token: string): Promise<void> {
  if (!validInvitationToken(token)) return;
  (await cookies()).set(COOKIE, JSON.stringify({ userId, token }), {
    httpOnly: true, secure: isProduction, sameSite: "lax", path: "/", maxAge: 3 * 24 * 60 * 60,
  });
}

export async function pendingInvitationPath(userId: string): Promise<string | null> {
  try {
    const hint = JSON.parse((await cookies()).get(COOKIE)?.value ?? "null");
    return hint?.userId === userId && validInvitationToken(hint.token) ? `/invite/${hint.token}` : null;
  } catch { return null; }
}

export async function clearPendingInvitation(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
