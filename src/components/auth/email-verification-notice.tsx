import Link from "next/link";
import { Alert } from "@/components/ui/alert";

export function EmailVerificationNotice({ verified }: { verified: boolean }) {
  if (verified) return null;
  return (
    <Alert title="Confirm your email" className="mb-5">
      Look for the verification email from MONO. You can finish setting up while you wait.{" "}
      <Link href="/verify-email" className="font-medium text-primary underline underline-offset-4">Verify or resend</Link>
    </Alert>
  );
}
