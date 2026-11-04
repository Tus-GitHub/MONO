import "server-only";

import nodemailer from "nodemailer";

import { env } from "@/config/env";
import type { EmailDriver, EmailMessage } from "@/lib/email/types";

/**
 * Authenticated SMTP with TLS, bounded connection times, and no file/URL attachments.
 * The transport is lazy so builds and console-email development need no credentials.
 */
export class SmtpEmailDriver implements EmailDriver {
  readonly name = "smtp";

  private transport?: ReturnType<typeof nodemailer.createTransport>;

  async send(message: EmailMessage): Promise<void> {
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
      throw new Error("SMTP configuration is incomplete.");
    }
    this.transport ??= nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      requireTLS: !env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      disableFileAccess: true,
      disableUrlAccess: true,
      tls: { minVersion: "TLSv1.2" },
    });
    const result = await this.transport.sendMail({
      from: env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    if (!result.accepted?.length || result.rejected?.length) {
      throw new Error("SMTP server did not accept the recipient.");
    }
  }
}
