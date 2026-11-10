import type { Metadata } from "next";
import { EmailVerificationForm } from "@/components/forms/email-verification-form";
import { Logo } from "@/components/layout/logo";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Confirm your email", referrer: "no-referrer" };

export default async function VerifyEmailPage() {
  const user = await getCurrentUser();
  return (
    <main className="flex min-h-dvh flex-col bg-paper px-4 py-12">
      <div className="m-auto w-full max-w-sm space-y-6">
        <div className="flex justify-center"><Logo /></div>
        <div className="space-y-6 rounded-xl border border-line bg-surface p-5 sm:p-6">
          <div>
            <h1 className="font-display text-2xl font-medium text-ink">Confirm your email</h1>
            <p className="mt-1 text-sm text-muted">One small step to make this space yours.</p>
          </div>
          <EmailVerificationForm currentEmail={user?.email} alreadyVerified={Boolean(user?.emailVerified)} />
        </div>
      </div>
    </main>
  );
}
