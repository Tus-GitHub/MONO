import "server-only";

import { prisma } from "@/lib/db/prisma";
import { AuthenticationError, AuthorizationError } from "@/lib/errors";
import { loginSchema } from "@/lib/validation/auth";
import { authenticate } from "@/server/services/auth-service";

export async function authenticateAdmin(input: unknown) {
  const user = await authenticate(loginSchema.parse(input));
  const grant = await prisma.adminAccess.findUnique({ where: { userId: user.id }, select: {
    user: { select: { emailVerified: true } },
  } });
  if (!grant) throw new AuthenticationError("Incorrect admin sign-in details.");
  if (!grant.user.emailVerified) throw new AuthorizationError("Verify your receiving email address before signing in to admin.");
  return user;
}
