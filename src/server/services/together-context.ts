import "server-only";
import type { Prisma } from "@prisma/client";
import { requireCoupleContext } from "@/lib/authz";
import { prisma } from "@/lib/db/prisma";
import { serializable } from "@/lib/db/serializable";
import { lockLivingUser } from "@/lib/authz/user-write";
import { AuthorizationError } from "@/lib/errors";

export async function requireTogether() {
  const context = await requireCoupleContext();
  if (!context.user.emailVerified || context.couple.status !== "ACTIVE") throw new AuthorizationError("Verify your email and connect both partners to use chat and games.");
  const members = await prisma.coupleMember.findMany({ where: { coupleId: context.couple.id, status: "ACTIVE", user: { deletedAt: null } }, select: { user: { select: { id: true, name: true, avatarUrl: true } } } });
  const partner = members.find((member) => member.user.id !== context.user.id)?.user;
  if (members.length !== 2 || !partner || !members.some((member) => member.user.id === context.user.id)) throw new AuthorizationError("Connect both partners to use chat and games.");
  return { ...context, partner };
}
export type TogetherContext = Awaited<ReturnType<typeof requireTogether>>;
export async function withTogetherWrite<T>(context: TogetherContext, work: (tx: Prisma.TransactionClient) => Promise<T>) {
  return serializable(async (tx) => {
    await lockLivingUser(tx, context.user.id);
    await tx.$queryRaw`SELECT id FROM couples WHERE id = ${context.couple.id} FOR UPDATE`;
    const current = await tx.couple.findFirst({ where: { id: context.couple.id, status: "ACTIVE", deletedAt: null }, select: { members: { where: { status: "ACTIVE", user: { deletedAt: null } }, select: { userId: true } } } });
    const ids = current?.members.map((member) => member.userId) ?? [];
    if (ids.length !== 2 || !ids.includes(context.user.id) || !ids.includes(context.partner.id)) throw new AuthorizationError("This shared space is no longer available.");
    return work(tx);
  });
}
export const bumpTogether = (tx: Prisma.TransactionClient, coupleId: string) => tx.couple.update({ where: { id: coupleId }, data: { togetherRevision: { increment: 1 } }, select: { togetherRevision: true } });
