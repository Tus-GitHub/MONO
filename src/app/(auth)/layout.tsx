import type { ReactNode } from "react";
import { AuthShell } from "@/components/layout/auth-shell";
import { redirectIfAuthenticated } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  await redirectIfAuthenticated();
  return <AuthShell>{children}</AuthShell>;
}
