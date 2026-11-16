import "server-only";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { serializable } from "@/lib/db/serializable";
import { requireUser } from "@/lib/auth/current-user";
import { requireAdmin } from "@/lib/auth/admin";
import { lockVerifiedUser } from "@/lib/authz/user-write";
import { eligibleArchivedPartner } from "@/lib/authz/archived-space";
import { idSchema } from "@/lib/validation/common";
import { ConflictError, NotFoundError } from "@/lib/errors";

const pageSchema = z.coerce.number().int().min(1).max(10000).catch(1);
const PAGE_SIZE = 20;
const decisionSchema = z.object({ requestId: idSchema, action: z.enum(["APPROVED", "DENIED", "REVOKED"]) });

export async function listMyArchivedSpaces(rawPage: unknown = 1) {
  const user = await requireUser(), page = pageSchema.parse(rawPage);
  const where: Prisma.CoupleWhereInput = { status: "ARCHIVED", deletedAt: null,
    AND: [{ members: { some: { userId: user.id } } }, { members: { some: { userId: { not: user.id }, user: { deletedAt: { not: null } } } } }],
  };
  const [total, rows] = await Promise.all([
    prisma.couple.count({ where }),
    prisma.couple.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: {
      id: true, name: true, updatedAt: true, members: { select: { userId: true } },
      accessRequests: { where: { requesterId: user.id }, select: { status: true, requestedAt: true, reviewedAt: true } },
      _count: { select: { dates: true, memories: true, chatMessages: true } },
    } }),
  ]);
  return { page, total, pages: Math.ceil(total / PAGE_SIZE), verified: !!user.emailVerified,
    rows: rows.filter(row => row.members.length === 2).map(({ accessRequests, members: _members, ...row }) => ({ ...row, request: accessRequests[0] ?? null })) };
}

export async function requestArchivedAccess(rawCoupleId: unknown) {
  const coupleId = idSchema.parse(rawCoupleId), user = await requireUser();
  return serializable(async tx => {
    await lockVerifiedUser(tx, user.id);
    await tx.$queryRaw`SELECT id FROM couples WHERE id = ${coupleId} FOR UPDATE`;
    await eligibleArchivedPartner(coupleId, user.id, tx);
    const where = { coupleId_requesterId: { coupleId, requesterId: user.id } };
    const previous = await tx.archiveAccessRequest.findUnique({ where });
    if (previous?.status === "PENDING" || previous?.status === "APPROVED") return { status: previous.status };
    if (previous && Date.now() - previous.requestedAt.getTime() < 60 * 60_000) throw new ConflictError("Please wait an hour before requesting another review.");
    const now = new Date();
    const decisions = [...(Array.isArray(previous?.decisions) ? previous.decisions : []), { status: "PENDING", actorId: user.id, at: now.toISOString() }] as Prisma.InputJsonValue;
    await tx.archiveAccessRequest.upsert({ where, create: { coupleId, requesterId: user.id, decisions },
      update: { status: "PENDING", requestedAt: now, reviewedAt: null, reviewedById: null, decisions } });
    const admins = await tx.adminAccess.findMany({ where: { user: { deletedAt: null, blockedAt: null, emailVerified: { not: null } } }, select: { userId: true } });
    if (admins.length) await tx.notification.createMany({ data: admins.map(admin => ({
      userId: admin.userId, type: "SYSTEM", entityType: "ArchiveAccessAdmin", title: "Archived space access requested", body: `Account ${user.id} requested access to space ${coupleId}.`, data: { href: "/admin?view=archives" },
    })) });
    return { status: "PENDING" as const };
  });
}

export async function listArchiveAccessRequests(rawPage: unknown = 1) {
  await requireAdmin();
  const page = pageSchema.parse(rawPage);
  const [total, pending, rows] = await Promise.all([
    prisma.archiveAccessRequest.count(), prisma.archiveAccessRequest.count({ where: { status: "PENDING" } }),
    prisma.archiveAccessRequest.findMany({ orderBy: [{ requestedAt: "desc" }, { id: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      select: { id: true, coupleId: true, requesterId: true, status: true, requestedAt: true, reviewedAt: true, reviewedById: true,
        requester: { select: { deletedAt: true, blockedAt: true, emailVerified: true } }, couple: { select: { status: true, deletedAt: true, members: { select: { userId: true, user: { select: { deletedAt: true } } } } } } } }),
  ]);
  return { page, total, pending, pages: Math.ceil(total / PAGE_SIZE), rows: rows.map(({ requester, couple, ...row }) => ({ ...row,
    eligible: !requester.deletedAt && !requester.blockedAt && !!requester.emailVerified && couple.status === "ARCHIVED" && !couple.deletedAt && couple.members.length === 2 && couple.members.some(member => member.userId === row.requesterId) && couple.members.some(member => member.userId !== row.requesterId && member.user.deletedAt),
  })) };
}

export async function reviewArchiveAccess(raw: unknown) {
  const input = decisionSchema.parse(raw);
  return serializable(async tx => {
    const admin = await requireAdmin(tx);
    const request = await tx.archiveAccessRequest.findUnique({ where: { id: input.requestId }, select: { coupleId: true, requesterId: true } });
    if (!request) throw new NotFoundError();
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${request.requesterId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM couples WHERE id = ${request.coupleId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM archive_access_requests WHERE id = ${input.requestId} FOR UPDATE`;
    const current = await tx.archiveAccessRequest.findUniqueOrThrow({ where: { id: input.requestId } });
    if (input.action === "APPROVED") await eligibleArchivedPartner(request.coupleId, request.requesterId, tx);
    if (current.status === input.action) return;
    const now = new Date();
    const decisions = [...(Array.isArray(current.decisions) ? current.decisions : []), { status: input.action, actorId: admin.id, at: now.toISOString() }] as Prisma.InputJsonValue;
    await tx.archiveAccessRequest.update({ where: { id: current.id }, data: { status: input.action, reviewedAt: now, reviewedById: admin.id, decisions } });
    await tx.notification.create({ data: { userId: request.requesterId, type: "SYSTEM", entityType: "ArchiveAccess", title: `Archived space access ${input.action.toLowerCase()}`,
      body: input.action === "APPROVED" ? "You can now view this archived shared space. It remains read-only." : "Your archived space access request has been reviewed.", data: { href: input.action === "APPROVED" ? `/history-access/${request.coupleId}` : "/history-access" } } });
  });
}
