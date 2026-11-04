import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { AuthProvider } from "@prisma/client";
import { z } from "zod";

import { writeSessionCookie } from "@/lib/auth/session-cookie";
import {
  googleProvider,
  googleRedirectUri,
  upsertUserFromOAuthProfile,
} from "@/lib/auth/oauth/google";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "mono_oauth_state";

const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  id_token: z.string().optional(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
  expires_in: z.number().positive().optional(),
});
const userInfoSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z.literal(true),
  name: z.string().optional(),
  picture: z.string().url().optional(),
});

function fail(request: NextRequest, reason: string) {
  return NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));
}

export async function GET(request: NextRequest) {
  if (!googleProvider.configured) {
    return NextResponse.json({ error: "google_oauth_not_configured" }, { status: 501 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const store = await cookies();
  const expectedState = store.get(STATE_COOKIE)?.value;
  const invite = store.get("mono_oauth_invite")?.value;
  store.delete(STATE_COOKIE);
  store.delete("mono_oauth_invite");

  if (!code || !state || !expectedState || state !== expectedState) {
    return fail(request, "oauth_state");
  }

  try {
    const tokenResponse = await fetch(googleProvider.tokenEndpoint, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: googleProvider.clientId,
        client_secret: googleProvider.clientSecret,
        redirect_uri: googleRedirectUri(),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenResponse.ok) return fail(request, "oauth_token");
    const tokens = tokenSchema.parse(await tokenResponse.json());

    const infoResponse = await fetch(googleProvider.userInfoEndpoint, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });
    if (!infoResponse.ok) return fail(request, "oauth_userinfo");
    const parsedInfo = userInfoSchema.safeParse(await infoResponse.json());
    if (!parsedInfo.success) return fail(request, "oauth_email");
    const info = parsedInfo.data;

    const user = await upsertUserFromOAuthProfile({
      provider: AuthProvider.GOOGLE,
      providerAccountId: info.sub,
      email: info.email,
      name: info.name ?? info.email,
      avatarUrl: info.picture ?? null,
      tokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
        tokenType: tokens.token_type,
        scope: tokens.scope,
        expiresAt: tokens.expires_in
          ? Math.floor(Date.now() / 1000) + tokens.expires_in
          : undefined,
      },
    });

    await writeSessionCookie({ userId: user.id, tokenVersion: user.tokenVersion });
    const destination = invite && /^[A-Za-z0-9_-]{16,200}$/.test(invite)
      ? `/invite/${encodeURIComponent(invite)}` : "/onboarding";
    return NextResponse.redirect(new URL(destination, request.url));
  } catch {
    // Provider/network/JSON failures return to the existing login error UI; no tokens logged.
    return fail(request, "oauth_token");
  }
}
