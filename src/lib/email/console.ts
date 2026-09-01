import type { EmailDriver, EmailMessage } from "@/lib/email/types";

/** Writes the message to the server log. The only driver wired up for development. */
export class ConsoleEmailDriver implements EmailDriver {
  readonly name = "console";

  async send(message: EmailMessage): Promise<void> {
    console.info(
      [
        "",
        "──────────── email (console driver) ────────────",
        `to:      ${message.to}`,
        `subject: ${message.subject}`,
        "",
        message.text,
        "───────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
  }
}
