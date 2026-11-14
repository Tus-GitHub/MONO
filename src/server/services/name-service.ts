import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ValidationError } from "@/lib/errors";
import { databaseConstraintTarget } from "@/lib/db/error-metadata";

export const NAME_TAKEN = "That exact name is already in use. Try another spelling or capitalization.";
export const nameTakenError = () => new ValidationError(NAME_TAKEN, { name: [NAME_TAKEN] });

export async function isNameAvailable(name: string, currentUserId?: string): Promise<boolean> {
  const existing = await prisma.user.findFirst({
    where: { name, deletedAt: null, ...(currentUserId ? { id: { not: currentUserId } } : {}) },
    select: { id: true },
  });
  return !existing;
}

export async function assertNameAvailable(name: string, currentUserId?: string): Promise<void> {
  if (!await isNameAvailable(name, currentUserId)) throw nameTakenError();
}

export function isNameConstraint(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = databaseConstraintTarget(error);
  return Array.isArray(target) ? target.includes("name") : typeof target === "string" && /users_active_name_key|\bname\b/.test(target);
}
