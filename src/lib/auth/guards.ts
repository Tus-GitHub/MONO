import "server-only";

import { redirect } from "next/navigation";

import { getCurrentUser, type SessionUser } from "@/lib/auth/current-user";

/**
 * Page/layout guard: return the user or send them to the login page. Use this in Server
 * Components. Server actions and route handlers should use `requireUser()` (throws) instead.
 */
export async function requireUserOrRedirect(redirectTo = "/login"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(redirectTo);
  return user;
}

/** Inverse guard: bounce already-authenticated users away from auth pages. */
export async function redirectIfAuthenticated(redirectTo = "/home"): Promise<void> {
  const user = await getCurrentUser();
  if (user) redirect(redirectTo);
}
