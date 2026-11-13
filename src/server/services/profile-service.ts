import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { UpdateProfileInput } from "@/lib/validation/profile";
import { assertNameAvailable, isNameConstraint, nameTakenError } from "@/server/services/name-service";
import { requireSelf } from "@/lib/authz/user-write";

export async function getProfile(userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      nickname: true,
      pronouns: true,
      birthday: true,
      email: true,
      avatarUrl: true,
      profileCompletedAt: true,
    },
  });
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  await requireSelf(userId);
  await assertNameAvailable(input.name, userId);
  try { return await prisma.user.update({
    where: { id: userId, deletedAt: null },
    data: {
      name: input.name,
      nickname: input.nickname ?? null,
      pronouns: input.pronouns ?? null,
      birthday: input.birthday ?? null,
    },
    select: { id: true },
  }); } catch (error) {
    if (isNameConstraint(error)) throw nameTakenError();
    throw error;
  }
}

/** Idempotent — safe to call again; the onboarding guard only checks it is set. */
export async function markProfileComplete(userId: string) {
  await prisma.user.updateMany({
    where: { id: userId, profileCompletedAt: null },
    data: { profileCompletedAt: new Date() },
  });
}
