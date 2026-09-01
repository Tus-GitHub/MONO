import type { EmailDriver, EmailMessage } from "@/lib/email/types";

/**
 * Placeholder SMTP driver. Lands with a real transport (e.g. `nodemailer`) and credentials;
 * not installed yet. Set `EMAIL_DRIVER=console` until then.
 */
export class SmtpEmailDriver implements EmailDriver {
  readonly name = "smtp";

  async send(_message: EmailMessage): Promise<void> {
    throw new Error(
      "The SMTP email driver is not implemented yet. Set EMAIL_DRIVER=console for now.",
    );
  }
}
