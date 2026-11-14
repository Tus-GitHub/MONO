import "server-only";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors";

/** Personal files stay private; only the current avatar is visible to an active partner. */
export async function requireUserMediaAccess(ownerId: string, key: string): Promise<void> {
  const viewer = await requireUser();
  if (viewer.id === ownerId) return;
  if (!key.startsWith(`users/${ownerId}/avatar/`)) throw new NotFoundError();

  const sharedMembership = await prisma.coupleMember.findFirst({
    where: {
      userId: ownerId,
      status: "ACTIVE",
      user: { deletedAt: null, avatarKey: key },
      couple: {
        deletedAt: null,
        status: { in: ["PENDING", "ACTIVE"] },
        members: { some: { userId: viewer.id, status: "ACTIVE", user: { deletedAt: null } } },
      },
    },
    select: { id: true },
  });
  if (!sharedMembership) throw new NotFoundError();
}
