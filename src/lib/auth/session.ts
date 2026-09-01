import { SignJWT, jwtVerify } from "jose";

import { env, isProduction } from "@/config/env";

/**
 * Stateless session tokens.
 *
 * The session is a signed JWT carried in an httpOnly cookie. It embeds the user's
 * `tokenVersion`; bumping `User.tokenVersion` (e.g. on password reset) invalidates every
 * outstanding session without server-side session storage. This module is runtime-agnostic
 * (only `jose`) so it can also run inside `src/proxy.ts`.
 */
export const SESSION_COOKIE_NAME = env.SESSION_COOKIE_NAME;
const MAX_AGE_SECONDS = env.SESSION_MAX_AGE_DAYS * 24 * 60 * 60;
const ISSUER = "mono";
const AUDIENCE = "mono:web";

const secret = new TextEncoder().encode(env.AUTH_SECRET);

export interface SessionPayload {
  userId: string;
  tokenVersion: number;
}

const SESSION_ONLY_SECONDS = 24 * 60 * 60; // "don't remember me" — one day, browser-session cookie

export async function signSession(payload: SessionPayload, remember = true): Promise<string> {
  return new SignJWT({ tv: payload.tokenVersion })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${remember ? MAX_AGE_SECONDS : SESSION_ONLY_SECONDS}s`)
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload.sub !== "string" || typeof payload.tv !== "number") return null;
    return { userId: payload.sub, tokenVersion: payload.tv };
  } catch {
    return null;
  }
}

/**
 * Options for the session cookie. Pass a number for a persistent cookie, or omit `maxAgeSeconds`
 * for a browser-session cookie ("remember me" unchecked). `0` clears it.
 */
export function sessionCookieOptions(maxAgeSeconds?: number) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    ...(maxAgeSeconds === undefined ? {} : { maxAge: maxAgeSeconds }),
  };
}

export const SESSION_MAX_AGE_SECONDS = MAX_AGE_SECONDS;
