import Link from "@/components/ui/app-link";
import { Alert } from "@/components/ui/alert";

export function EmailVerificationNotice({ verified }: { verified: boolean }) {
  if (verified) return null;
  return (
    <Alert title="Confirm your email" className="mb-5">
      Look for the verification email from MONO. You can set up your profile while you wait; verify before creating or joining a space.{" "}
      <Link href="/verify-email" className="font-medium text-primary underline underline-offset-4">Verify or resend</Link>
    </Alert>
  );
}
