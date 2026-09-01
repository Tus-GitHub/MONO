import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isProduction } from "@/config/env";
import { googleProvider, googleRedirectUri } from "@/lib/auth/oauth/google";
import { randomToken } from "@/lib/utils/crypto";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "mono_oauth_state";

export async function GET() {
  if (!googleProvider.configured) {
    return NextResponse.json(
      { error: "google_oauth_not_configured", hint: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." },
      { status: 501 },
    );
  }

  const state = randomToken(16);
  const store = await cookies();
  store.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const authUrl = new URL(googleProvider.authorizationEndpoint);
  authUrl.searchParams.set("client_id", googleProvider.clientId);
  authUrl.searchParams.set("redirect_uri", googleRedirectUri());
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", googleProvider.scopes.join(" "));
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  return NextResponse.redirect(authUrl);
}
