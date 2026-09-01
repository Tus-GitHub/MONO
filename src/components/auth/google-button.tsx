import { focusRing } from "@/components/ui/_shared";
import { googleOAuthConfigured } from "@/config/env";
import { cn } from "@/lib/utils/cn";

function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17Z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7A21.99 21.99 0 0 0 24 46Z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18A13.2 13.2 0 0 1 11 24c0-1.45.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7Z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 3.99 29.93 2 24 2 15.4 2 7.96 6.94 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07Z"
      />
    </svg>
  );
}

/** Renders only when Google OAuth credentials are configured. */
export function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
  if (!googleOAuthConfigured) return null;
  return (
    <a
      href="/api/auth/google/start"
      className={cn(
        "inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-line bg-surface text-sm font-medium text-ink transition-colors hover:border-line-strong hover:bg-elevated",
        focusRing,
      )}
    >
      <GoogleG className="size-4" />
      {label}
    </a>
  );
}

/** The "or" divider used between Google and the email form. */
export function AuthDivider() {
  return (
    <div className="flex items-center gap-3 text-2xs font-medium uppercase tracking-wide text-faint">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** Google button + divider, or nothing when Google isn't configured. */
export function GoogleAuthBlock({ label }: { label?: string }) {
  if (!googleOAuthConfigured) return null;
  return (
    <>
      <GoogleButton label={label} />
      <AuthDivider />
    </>
  );
}
