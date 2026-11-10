import bcrypt from "bcryptjs";

export { passwordSchema } from "@/lib/validation/password";

/**
 * Password hashing and strength rules. Plaintext passwords are never stored or logged.
 */
const BCRYPT_COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/**
 * Verify a password against a stored hash. When the account has no password (OAuth-only) we
 * still run a hash to keep the response time roughly constant, then report failure.
 */
export async function verifyPassword(
  plain: string,
  hash: string | null | undefined,
): Promise<boolean> {
  if (!hash) {
    await bcrypt.hash(plain, BCRYPT_COST);
    return false;
  }
  return bcrypt.compare(plain, hash);
}

/** True when a stored hash predates the current cost factor and should be re-hashed on login. */
export function needsRehash(hash: string): boolean {
  const rounds = bcrypt.getRounds(hash);
  return Number.isFinite(rounds) && rounds < BCRYPT_COST;
}
