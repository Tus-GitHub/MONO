import "server-only";

import { prisma } from "@/lib/db/prisma";
import { ValidationError } from "@/lib/errors";
import { emailSchema } from "@/lib/validation/common";

export const EMAIL_REGISTERED = "This email is already registered. Sign in or use another email.";

export function emailRegisteredError() {
  return new ValidationError(EMAIL_REGISTERED, { email: [EMAIL_REGISTERED] });
}

export async function isRegistrationEmailAvailable(value: string): Promise<boolean> {
  const email = emailSchema.parse(value);
  // Match the existing global email constraint, including closed accounts.
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return !existing;
}
