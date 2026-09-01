import { env, isProduction } from "@/config/env";
import { ConsoleEmailDriver } from "@/lib/email/console";
import { SmtpEmailDriver } from "@/lib/email/smtp";
import { passwordResetEmail } from "@/lib/email/templates";
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
}
