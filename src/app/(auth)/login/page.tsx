import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/forms/login-form";
import { GoogleAuthBlock } from "@/components/auth/google-button";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; invite?: string }>;
}) {
  const { reset, invite } = await searchParams;
  const suffix = invite ? `?invite=${encodeURIComponent(invite)}` : "";

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-ink">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Pick up where the two of you left off.</p>

      {reset === "1" ? (
        <div className="mt-4">
          <Alert tone="success">Your password was updated. Sign in with your new password.</Alert>
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        <GoogleAuthBlock label="Sign in with Google" />
        <LoginForm invite={invite} />
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        New to MONO?{" "}
        <Link
          href={`/register${suffix}`}
          className="font-medium text-primary transition-colors hover:text-primary-hover"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
