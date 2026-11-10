import { env, isProduction } from "@/config/env";
import { ConsoleEmailDriver } from "@/lib/email/console";
import { SmtpEmailDriver } from "@/lib/email/smtp";
import { passwordResetEmail, verificationEmail, welcomeEmail } from "@/lib/email/templates";
import type { EmailDriver, EmailMessage } from "@/lib/email/types";

export type { EmailDriver, EmailMessage } from "@/lib/email/types";

function createDriver(): EmailDriver {
  switch (env.EMAIL_DRIVER) {
    case "smtp":
      return new SmtpEmailDriver();
    case "console":
    default:
      return new ConsoleEmailDriver();
  }
}

const globalForMailer = globalThis as unknown as { mailer?: EmailDriver };

export const mailer: EmailDriver = globalForMailer.mailer ?? createDriver();

if (!isProduction) globalForMailer.mailer = mailer;

export async function sendEmail(message: EmailMessage): Promise<void> {
  await mailer.send(message);
}

export async function sendPasswordResetEmail(args: {
  to: string;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}): Promise<void> {
  await mailer.send(passwordResetEmail(args));
  if (mailer.name === "smtp") console.info("[email] Password reset accepted by SMTP.");
}

export async function sendWelcomeEmail(args: { to: string; name: string; appUrl: string }): Promise<void> {
  await mailer.send(welcomeEmail(args));
  if (mailer.name === "smtp") console.info("[email] Welcome accepted by SMTP.");
}

export async function sendVerificationEmail(args: { to: string; name: string; verifyUrl: string }): Promise<void> {
  await mailer.send(verificationEmail(args));
  if (mailer.name === "smtp") console.info("[email] Verification accepted by SMTP.");
}
