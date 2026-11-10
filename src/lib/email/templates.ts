import type { EmailMessage } from "@/lib/email/types";

interface Recipient { to: string; name: string }

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]!);

// Email clients need inline colors; these mirror MONO's light tokens in app/globals.css.
const theme = { paper: "#f5f1ea", surface: "#fdfbf7", ink: "#211c17", muted: "#766c60", line: "#e7dfd3", primary: "#b45a41" };

function emailLink(value: string): string {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) {
    throw new Error("MONO emails require a trusted HTTPS link.");
  }
  return url.toString();
}

function accountEmail(args: Recipient & {
  url: string; subject: string; eyebrow: string; heading: string; body: string;
  button: string; details: string; safety: string;
}): EmailMessage {
  const url = emailLink(args.url);
  const name = args.name.trim() || "there";
  const text = [
    "MONO — A private space for two.",
    "",
    `Hi ${name},`,
    "",
    args.heading.replace(/\n/g, " "),
    args.body,
    "",
    `${args.button}: ${url}`,
    "",
    args.details,
    args.safety,
    "",
    "— MONO",
  ].join("\n");

  const link = escapeHtml(url);
  const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(args.subject)}</title></head>
<body style="margin:0;padding:0;background:${theme.paper};color:${theme.ink};font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(args.heading.replace(/\n/g, " "))} ${escapeHtml(args.details)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${theme.paper}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:${theme.surface};border:1px solid ${theme.line};border-radius:20px;overflow:hidden">
<tr><td style="padding:28px 28px 24px;border-bottom:1px solid ${theme.line}"><p style="margin:0;color:${theme.ink};font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:bold;letter-spacing:6px">MONO</p><p style="margin:10px 0 0;color:${theme.muted};font-size:12px;line-height:1.6">A private space for two.</p></td></tr>
<tr><td style="padding:32px 28px">
<p style="margin:0 0 16px;font-size:11px;letter-spacing:2px;color:${theme.primary};font-weight:bold">${escapeHtml(args.eyebrow)}</p>
<h1 style="margin:0 0 22px;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;font-weight:normal;color:${theme.ink}">${args.heading.split("\n").map(escapeHtml).join("<br>")}</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:${theme.ink}">Hi ${escapeHtml(name)},</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:${theme.muted}">${escapeHtml(args.body)}</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="${theme.primary}" style="border-radius:10px"><a href="${link}" style="display:inline-block;padding:15px 22px;font-size:14px;font-weight:bold;color:${theme.surface};text-decoration:none">${escapeHtml(args.button)}</a></td></tr></table>
<p style="margin:22px 0 0;font-size:13px;line-height:1.7;color:${theme.muted}">${escapeHtml(args.details)}</p>
<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid ${theme.line};font-size:12px;line-height:1.7;color:${theme.muted}">Button not working? Copy this link into your browser:<br><a href="${link}" style="color:${theme.primary};text-decoration:underline;overflow-wrap:anywhere;word-break:break-all">${link}</a></p>
</td></tr>
<tr><td style="padding:20px 28px;background:${theme.paper};border-top:1px solid ${theme.line}"><p style="margin:0;font-size:11px;line-height:1.8;color:${theme.muted}">${escapeHtml(args.safety)} MONO will never ask you to send your password by email.<br><span style="color:${theme.ink}">MONO · Make time. Keep the memory.</span></p></td></tr>
</table></td></tr></table>
</body></html>`;

  return {
    to: args.to,
    subject: args.subject,
    text,
    html,
  };
}

export function passwordResetEmail(args: Recipient & { resetUrl: string; expiresInMinutes: number }): EmailMessage {
  return accountEmail({ ...args, url: args.resetUrl, subject: "Reset your MONO password", eyebrow: "ACCOUNT RECOVERY",
    heading: "A fresh password.\nYour same shared space.",
    body: "We received a request to reset your MONO password. Choose a new one to get back to your dates, memories and the things you keep together.",
    button: "Choose a new password",
    details: `This link expires in ${args.expiresInMinutes} minutes and can be used once. If you didn't request this, you can ignore this email. Your password will stay the same.`,
    safety: "Never share your password or this reset link.",
  });
}

export function welcomeEmail(args: Recipient & { appUrl: string }): EmailMessage {
  return accountEmail({ ...args, url: args.appUrl, subject: "Welcome to MONO", eyebrow: "YOUR STORY STARTS HERE",
    heading: "Make time.\nKeep the memory.",
    body: "Welcome to your private space for two. Plan your dates, keep the little moments and build a story you can look back on together.",
    button: "Start your story",
    details: "Your account is ready. Finish your profile and connect with your partner when you're ready. Look for a separate email to confirm your email address.",
    safety: "If you didn't create a MONO account, you can ignore this email.",
  });
}

export function verificationEmail(args: Recipient & { verifyUrl: string }): EmailMessage {
  return accountEmail({ ...args, url: args.verifyUrl, subject: "Verify your MONO email", eyebrow: "EMAIL CONFIRMATION",
    heading: "One small step.\nYour space, confirmed.",
    body: "Confirm that this email address belongs to you. Open the link below, then choose Verify email address on the confirmation page.",
    button: "Verify email address",
    details: "This link expires in 24 hours and can be used once. If you didn't create an account or request this email, you can safely ignore it.",
    safety: "Keep this verification link private. It confirms your email and does not sign anyone in.",
  });
}
