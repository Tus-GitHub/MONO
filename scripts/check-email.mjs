/** Verify SMTP connectivity/authentication without sending an email. */
import { loadEnvFile } from "node:process";
import nodemailer from "nodemailer";

try { loadEnvFile(".env"); } catch (error) { if (error.code !== "ENOENT") throw error; }
const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD } = process.env;
if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
  console.error("Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD first. No email was sent.");
  process.exit(1);
}
const secure = /^(true|1)$/i.test(process.env.SMTP_SECURE ?? "false");
const transport = nodemailer.createTransport({
  host: SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), secure, requireTLS: !secure,
  auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
  tls: { minVersion: "TLSv1.2" },
});
try {
  await transport.verify();
  console.log("PASS: SMTP connection, TLS and authentication. No email was sent.");
} catch {
  console.error("FAIL: SMTP verification failed. Check host, port, TLS mode and credentials.");
  process.exitCode = 1;
} finally { transport.close(); }
