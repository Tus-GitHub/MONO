import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasAdminAccess } from "@/lib/auth/admin";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };
export default async function AdminLoginPage() {
  const user = await getCurrentUser();
  if (user && await hasAdminAccess(user.id)) redirect("/admin");
  return <main className="mono-auth-main flex min-h-dvh flex-col bg-paper px-4 py-12">
    <div className="m-auto w-full max-w-sm space-y-6 rounded-xl border border-line bg-surface p-6">
      <div><p className="text-sm font-medium text-primary">AMOR · Admin</p><h1 className="mt-2 font-display text-2xl text-ink">Admin sign in</h1><p className="mt-2 text-sm text-muted">Manage account reports and moderation.</p></div>
      <AdminLoginForm />
      <details className="space-y-4 text-sm"><summary className="cursor-pointer text-primary">Forgot password?</summary><p className="text-muted">Enter your admin alias or receiving email. Recovery links go to the verified receiving mailbox.</p><ForgotPasswordForm /></details>
      <Link href="/verify-email" className="inline-block text-sm text-primary">Verify receiving email</Link>
    </div>
  </main>;
}
