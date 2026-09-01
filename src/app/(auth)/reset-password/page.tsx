import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "@/components/forms/reset-password-form";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <Card>
      <h1 className="text-lg font-semibold text-ink">
        Choose a new password
      </h1>
      <p className="mb-5 mt-1 text-sm text-muted">
        Pick something you don&apos;t use anywhere else.
      </p>

      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Alert tone="error">
          This reset link is missing its token. Request a new one from the{" "}
          <Link href="/forgot-password" className="font-medium underline">
            reset page
          </Link>
          .
        </Alert>
      )}
    </Card>
  );
}
