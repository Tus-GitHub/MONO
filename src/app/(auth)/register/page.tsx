import type { Metadata } from "next";
import Link from "next/link";

import { GoogleAuthBlock } from "@/components/auth/google-button";
import { RegisterForm } from "@/components/forms/register-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  const suffix = invite ? `?invite=${encodeURIComponent(invite)}` : "";

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-ink">Start your MONO</h1>
      <p className="mt-1 text-sm text-muted">
        {invite
          ? "Create your account, then accept your partner's invitation."
          : "One account per person — you'll connect with your partner next."}
      </p>

      <div className="mt-6 space-y-4">
        <GoogleAuthBlock label="Sign up with Google" />
        <RegisterForm invite={invite} />
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href={`/login${suffix}`}
          className="font-medium text-primary transition-colors hover:text-primary-hover"
        >
          Sign in
        </Link>
      </p>

      <p className="mt-4 text-center text-2xs leading-relaxed text-faint">
        MONO is private by design. Your space is visible only to the two people in it.
      </p>
    </div>
  );
}
