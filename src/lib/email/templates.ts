import type { EmailMessage } from "@/lib/email/types";

interface PasswordResetArgs {
  to: string;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]!);

// Email clients need inline colors; these mirror MONO's light tokens in app/globals.css.
const theme = { paper: "#f5f1ea", surface: "#fdfbf7", ink: "#211c17", muted: "#766c60", line: "#e7dfd3", primary: "#b45a41" };

export function passwordResetEmail(args: PasswordResetArgs): EmailMessage {
  const url = new URL(args.resetUrl);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) {
    throw new Error("Password reset emails require a trusted HTTPS link.");
  }
  const resetUrl = url.toString();
  const name = args.name.trim() || "there";
  const text = [
    "MONO — A private space for two.",
    "",
    `Hi ${name},`,
    "",
    "We received a request to reset your MONO password. Open this link to choose a new one:",
    resetUrl,
    "",
    `This link expires in ${args.expiresInMinutes} minutes and can be used once.`,
    "If you didn't ask for this, you can ignore this email — your password won't change.",
    "Never share your password or this reset link.",
    "",
    "— MONO",
  ].join("\n");

  const link = escapeHtml(resetUrl);
  const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Reset your MONO password</title></head>
<body style="margin:0;padding:0;background:${theme.paper};color:${theme.ink};font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">Choose a new password and come back to your shared space. Your link expires in ${args.expiresInMinutes} minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${theme.paper}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:${theme.surface};border:1px solid ${theme.line};border-radius:20px;overflow:hidden">
<tr><td style="padding:28px 28px 24px;border-bottom:1px solid ${theme.line}"><p style="margin:0;color:${theme.ink};font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:bold;letter-spacing:6px">MONO</p><p style="margin:10px 0 0;color:${theme.muted};font-size:12px;line-height:1.6">A private space for two.</p></td></tr>
<tr><td style="padding:32px 28px">
<p style="margin:0 0 16px;font-size:11px;letter-spacing:2px;color:${theme.primary};font-weight:bold">ACCOUNT RECOVERY</p>
<h1 style="margin:0 0 22px;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;font-weight:normal;color:${theme.ink}">A fresh password.<br>Your same shared space.</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:${theme.ink}">Hi ${escapeHtml(name)},</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:${theme.muted}">We received a request to reset your MONO password. Choose a new one to get back to your dates, memories and the things you keep together.</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="${theme.primary}" style="border-radius:10px"><a href="${link}" style="display:inline-block;padding:15px 22px;font-size:14px;font-weight:bold;color:${theme.surface};text-decoration:none">Choose a new password</a></td></tr></table>
<p style="margin:22px 0 0;font-size:13px;line-height:1.7;color:${theme.muted}">This link expires in <strong style="color:${theme.ink}">${args.expiresInMinutes} minutes</strong> and can be used once. If you didn&apos;t request this, you can ignore this email. Your password will stay the same.</p>
<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid ${theme.line};font-size:12px;line-height:1.7;color:${theme.muted};overflow-wrap:anywhere;word-break:break-all">Button not working? Copy this link into your browser:<br><a href="${link}" style="color:${theme.primary};text-decoration:underline">${link}</a></p>
</td></tr>
<tr><td style="padding:20px 28px;background:${theme.paper};border-top:1px solid ${theme.line}"><p style="margin:0;font-size:11px;line-height:1.8;color:${theme.muted}">Never share your password or this reset link. MONO will never ask you to send your password by email.<br><span style="color:${theme.ink}">MONO · Make time. Keep the memory.</span></p></td></tr>
</table></td></tr></table>
</body></html>`;

  return {
    to: args.to,
    subject: "Reset your MONO password",
    text,
    html,
  };
}
