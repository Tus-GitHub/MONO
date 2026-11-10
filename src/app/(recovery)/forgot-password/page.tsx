import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <Card>
      <h1 className="text-lg font-semibold text-ink">Reset your password</h1>
      <p className="mb-5 mt-1 text-sm text-muted">
        Enter your email and we&apos;ll send a link to set a new password.
      </p>

      <ForgotPasswordForm />

      <p className="mt-5 text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-primary transition-colors hover:text-primary-hover">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}
