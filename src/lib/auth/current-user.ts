import "server-only";

import { cache } from "react";

import { AuthenticationError } from "@/lib/errors";
import { prisma } from "@/lib/db/prisma";
import { readSessionToken } from "@/lib/auth/session-cookie";
import { verifySession } from "@/lib/auth/session";

/** The authenticated user as the app is allowed to see it — never includes `passwordHash`. */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: Date | null;
  createdAt: Date;
}

/**
 * Resolve the current user from the session cookie. Memoized per request via `React.cache`,
 * so calling it in the layout, the page, and a server action costs one query.
 * Returns `null` when there is no valid session (bad/expired token, unknown user, a
 * `tokenVersion` mismatch from a password reset, or a soft-deleted account).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = await readSessionToken();
  if (!token) return null;

  const payload = await verifySession(token);
  if (!payload) return null;

  const user = await prisma.user.findFirst({
    where: { id: payload.userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      emailVerified: true,
      createdAt: true,
      tokenVersion: true,
    },
  });
  if (!user || user.tokenVersion !== payload.tokenVersion) return null;

  const { tokenVersion: _tokenVersion, ...safe } = user;
  return safe;
});

/** Same as `getCurrentUser` but throws `AuthenticationError` when unauthenticated. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthenticationError();
  return user;
}
