/**
 * Auth surface. Import framework-facing helpers from here.
 *
 *   getCurrentUser()          - user or null (memoized per request)   [Server Components/actions]
 *   requireUser()             - user or throws AuthenticationError     [actions / route handlers]
 *   requireUserOrRedirect()   - user or redirect('/login')            [Server Components]
 *   redirectIfAuthenticated() - bounce signed-in users off auth pages [Server Components]
 */
export { getCurrentUser, requireUser, type SessionUser } from "@/lib/auth/current-user";
export { requireUserOrRedirect, redirectIfAuthenticated } from "@/lib/auth/guards";
export {
  writeSessionCookie,
  clearSessionCookie,
  readSessionToken,
} from "@/lib/auth/session-cookie";
export {
  hashPassword,
  verifyPassword,
  needsRehash,
  passwordSchema,
} from "@/lib/auth/password";
export { SESSION_COOKIE_NAME } from "@/lib/auth/session";
