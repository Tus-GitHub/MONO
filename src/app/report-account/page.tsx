import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getReportableAccounts } from "@/server/services/moderation-service";
import { ReportAccountForm } from "@/components/settings/report-account-form";

export const metadata: Metadata = { title: "Report an account" };
export default async function ReportAccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.emailVerified) redirect("/verify-email");
  const accounts = await getReportableAccounts();
  return <main className="mx-auto min-h-dvh max-w-xl space-y-6 px-4 py-8">
    <Link href="/home" className="text-sm text-primary">Back to MONO</Link>
    <h1 className="font-display text-3xl text-ink">Report an account</h1>
    <p className="text-sm text-muted">The admin will review your report before deciding whether any account action is needed.</p>
    <ReportAccountForm accounts={accounts} />
  </main>;
}
