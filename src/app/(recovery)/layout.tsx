import type { ReactNode } from "react";
import { AuthShell } from "@/components/layout/auth-shell";

// Mailbox recovery remains available even when this browser already has a session.
export default function RecoveryLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
