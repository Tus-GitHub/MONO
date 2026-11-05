import "server-only";

import { AuthProvider } from "@prisma/client";

import { env, googleOAuthConfigured } from "@/config/env";
import { serializable } from "@/lib/db/serializable";
import { AuthenticationError } from "@/lib/errors";

/**
 * Google sign-in — architecture seam.
 *
 * The `Account` table, this provider config, and `upsertUserFromOAuthProfile` are all in
 * place so Google (or any OIDC provider) can be switched on by adding credentials and a
 * callback route — no schema or session change required. Nothing here runs until
 * `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are set.
 */
export const googleProvider = {
  id: "google",
  authProvider: AuthProvider.GOOGLE,
  get configured() {
    return googleOAuthConfigured;
  },
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  userInfoEndpoint: "https://openidconnect.googleapis.com/v1/userinfo",
  scopes: ["openid", "email", "profile"] as const,
  callbackPath: "/api/auth/google/callback",
} as const;

export function googleRedirectUri(): string {
  return new URL(googleProvider.callbackPath, env.APP_URL).toString();
}

export interface OAuthProfile {
  provider: AuthProvider;
  providerAccountId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  tokens?: {
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
    tokenType?: string;
    scope?: string;
    expiresAt?: number;
  };
}

/**
 * Idempotently resolve a local user for an external identity. An existing `Account` wins;
 * otherwise we link to a user with the same (verified) email, creating one if needed.
 */
export async function upsertUserFromOAuthProfile(profile: OAuthProfile) {
  const email = profile.email.trim().toLowerCase();

  return serializable(async (tx) => {
    const linked = await tx.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: { user: true },
    });
    if (linked) {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${linked.userId} FOR UPDATE`;
      const current = await tx.user.findUniqueOrThrow({ where: { id: linked.userId } });
      if (current.deletedAt) throw new AuthenticationError("This account is unavailable.");
      return current;
    }

    const user =
      (await tx.user.findUnique({ where: { email } })) ??
      (await tx.user.create({
        data: {
          email,
          name: profile.name || email,
          avatarUrl: profile.avatarUrl ?? null,
          emailVerified: new Date(),
        },
      }));

    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${user.id} FOR UPDATE`;
    const current = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
    if (current.deletedAt) throw new AuthenticationError("This account is unavailable.");
    await tx.account.create({
      data: {
        userId: user.id,
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
        accessToken: profile.tokens?.accessToken ?? null,
        refreshToken: profile.tokens?.refreshToken ?? null,
        idToken: profile.tokens?.idToken ?? null,
        tokenType: profile.tokens?.tokenType ?? null,
        scope: profile.tokens?.scope ?? null,
        expiresAt: profile.tokens?.expiresAt ?? null,
      },
    });

    return current;
  });
}
