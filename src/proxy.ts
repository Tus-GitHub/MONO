import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME, verifySession } from "@/lib/auth/session";

/**
 * Edge-of-app gate (Next.js "Proxy", formerly Middleware). It only checks the *signature and
 * expiry* of the session cookie to keep unauthenticated traffic off protected routes — the
 * authoritative checks (user still exists, token version, couple membership) happen in the
 * protected layout, server actions, and the authorization layer. No database access here.
 */
const PROTECTED_PREFIXES = [
  "/home",
  "/dashboard",
  "/onboarding",
  "/plan",
  "/dates",
  "/places",
  "/explore",
  "/memories",
  "/expenses",
  "/couple",
  "/notifications",
  "/settings",
];

const AUTH_ONLY_PATHS = ["/login", "/register"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;

  if (isProtected(pathname) && !session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (session && AUTH_ONLY_PATHS.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|sw.js|manifest.webmanifest|icons/|media/|api/).*)",
  ],
};
