import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** URL-safe random string, e.g. for password-reset tokens. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** SHA-256 hex digest. Used to store only the hash of emailed tokens. */
export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I

/** Human-friendly couple invite code, e.g. "K4P-7QMR". */
export function generateInviteCode(): string {
  const pick = () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  const group = (length: number) => Array.from({ length }, pick).join("");
  return `${group(3)}-${group(4)}`;
}
