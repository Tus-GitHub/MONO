import type { EmailMessage } from "@/lib/email/types";

interface PasswordResetArgs {
  to: string;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export function passwordResetEmail(args: PasswordResetArgs): EmailMessage {
  const text = [
    `Hi ${args.name},`,
    "",
    "We received a request to reset your MONO password. Open this link to choose a new one:",
    args.resetUrl,
    "",
    `This link expires in ${args.expiresInMinutes} minutes and can be used once.`,
    "If you didn't ask for this, you can ignore this email — your password won't change.",
    "",
    "— MONO",
  ].join("\n");

  return {
    to: args.to,
    subject: "Reset your MONO password",
    text,
  };
}
