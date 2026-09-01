import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { AuthProvider } from "@prisma/client";

import { writeSessionCookie } from "@/lib/auth/session-cookie";
import {
  googleProvider,
  googleRedirectUri,
  upsertUserFromOAuthProfile,
} from "@/lib/auth/oauth/google";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "mono_oauth_state";

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
}

interface GoogleUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

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
  store.delete(STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    return fail(request, "oauth_state");
  }

  const tokenResponse = await fetch(googleProvider.tokenEndpoint, {
    method: "POST",
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
  const tokens = (await tokenResponse.json()) as GoogleTokenResponse;

  const infoResponse = await fetch(googleProvider.userInfoEndpoint, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  if (!infoResponse.ok) return fail(request, "oauth_userinfo");
  const info = (await infoResponse.json()) as GoogleUserInfo;

  if (!info.email || info.email_verified === false) {
    return fail(request, "oauth_email");
  }

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
  return NextResponse.redirect(new URL("/onboarding", request.url));
}
