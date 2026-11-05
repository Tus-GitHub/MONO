import "server-only";

import { prisma } from "@/lib/db/prisma";
import { serializable } from "@/lib/db/serializable";
import { AuthenticationError } from "@/lib/errors";
import { SESSION_MAX_AGE_SECONDS, SESSION_ONLY_MAX_AGE_SECONDS, type SessionPayload } from "./session";

/** Store only a coarse browser/platform label; never persist IPs, raw agents or bearer tokens. */
export function sessionDeviceLabel(agent: string | null): string {
  const ua = (agent ?? "").slice(0, 512);
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /(?:Chrome|CriOS)\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const platform = /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Macintosh|Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : null;
  return platform ? `${browser} on ${platform}` : browser;
}

/** Credential validation and session creation are separated by hashing/network work. Recheck under lock. */
export async function createAuthSession(identity: Pick<SessionPayload, "userId" | "tokenVersion">, remember: boolean, agent: string | null = null, pushDeviceId?: string) {
  return serializable(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${identity.userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: identity.userId }, select: { deletedAt: true, tokenVersion: true } });
    if (!user || user.deletedAt || user.tokenVersion !== identity.tokenVersion) throw new AuthenticationError("Sign in again to continue.");
    const now = new Date();
    await tx.authSession.deleteMany({ where: { userId: identity.userId, OR: [{ expiresAt: { lte: now } }, { revokedAt: { not: null } }] } });
    const sessions = await tx.authSession.findMany({ where: { userId: identity.userId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: 19, select: { id: true } });
    if (sessions.length) await tx.authSession.updateMany({ where: { id: { in: sessions.map((row) => row.id) } }, data: { revokedAt: now } });
    const session = await tx.authSession.create({ data: {
      ...identity, deviceLabel: sessionDeviceLabel(agent),
      expiresAt: new Date(now.getTime() + (remember ? SESSION_MAX_AGE_SECONDS : SESSION_ONLY_MAX_AGE_SECONDS) * 1000),
    } });
    if (pushDeviceId) await tx.pushSubscription.updateMany({ where: { id: pushDeviceId, userId: identity.userId }, data: { authSessionId: session.id } });
    return session;
  });
}

/** Authoritative check used by every protected request; a signed token alone is insufficient. */
export async function resolveSessionUser(payload: SessionPayload) {
  const now = new Date();
  const session = await prisma.authSession.findFirst({ where: {
    id: payload.sessionId, userId: payload.userId, tokenVersion: payload.tokenVersion,
    revokedAt: null, expiresAt: { gt: now }, user: { deletedAt: null, tokenVersion: payload.tokenVersion },
  }, select: {
    lastSeenAt: true,
    user: { select: { id: true, email: true, name: true, avatarUrl: true, emailVerified: true, createdAt: true } },
  } });
  if (!session) return null;
  if (session.lastSeenAt.getTime() < now.getTime() - 5 * 60_000) {
    await prisma.authSession.updateMany({ where: { id: payload.sessionId, revokedAt: null, lastSeenAt: { lt: new Date(now.getTime() - 5 * 60_000) } }, data: { lastSeenAt: now } });
  }
  return session.user;
}
