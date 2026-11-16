import "server-only";
import { adminCoupleStorage } from "./admin-couple-storage";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { serializable } from "@/lib/db/serializable";
import { requireAdmin } from "@/lib/auth/admin";
import { requireUser } from "@/lib/auth/current-user";
import { lockVerifiedUser } from "@/lib/authz/user-write";
import { emailFingerprint, lockRegistrationEmail } from "@/lib/auth/registration-policy";
import { AuthorizationError, ConflictError, NotFoundError } from "@/lib/errors";
import { accountReportSchema, adminQuerySchema, moderationSchema, reviewReportSchema } from "@/lib/validation/moderation";
import { deleteAccountInTransaction } from "@/server/services/account-service";

const PAGE_SIZE = 25;

/** Explicit DTOs: account metadata never includes names, addresses or private content. */
export async function getAdminDashboard(rawQuery: unknown = {}) {
  await requireAdmin();
  const query = adminQuerySchema.parse(rawQuery);
  const skip = (query.page - 1) * PAGE_SIZE;
  const where = query.query ? { id: { contains: query.query } } : {};
  const couples = await adminCoupleStorage(query.query, skip, PAGE_SIZE);
  const [totalAccounts, activeAccounts, openReports, accountCount, accounts, reportCount, reports, audit, attachments, database] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({ where: { deletedAt: null, blockedAt: null } }),
    prisma.accountReport.count({ where: { status: "OPEN" } }),
    prisma.user.count({ where }),
    prisma.user.findMany({ where, skip, take: PAGE_SIZE, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: {
      id: true, deletedAt: true, blockedAt: true, adminAccess: { select: { userId: true } },
    } }),
    prisma.accountReport.count({ where: { status: query.reportStatus } }),
    prisma.accountReport.findMany({ where: { status: query.reportStatus }, skip, take: PAGE_SIZE,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: {
        id: true, reporterId: true, targetId: true, category: true, details: true, status: true,
        createdAt: true, reviewNote: true,
      } }),
    prisma.moderationAudit.findMany({ skip, take: PAGE_SIZE, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: {
      id: true, actorId: true, targetId: true, action: true, reason: true, createdAt: true,
    } }),
    prisma.chatImage.aggregate({ _sum: { byteLength: true }, _count: { _all: true } }),
    prisma.$queryRaw<{ bytes: bigint }[]>`SELECT pg_database_size(current_database()) AS bytes`,
  ]);
  return { storage: { attachmentBytes: attachments._sum.byteLength ?? 0, attachmentCount: attachments._count._all, databaseBytes: Number(database[0]?.bytes ?? 0) }, query, totalAccounts, activeAccounts, openReports, accountCount, reportCount, pageSize: PAGE_SIZE,
    accounts: accounts.map((row) => ({ id: row.id, deleted: !!row.deletedAt, blocked: !!row.blockedAt, admin: !!row.adminAccess })),
    reports, audit, couples,
  };
}

export async function getReportableAccounts() {
  const user = await requireUser();
  // Former partners remain reportable after a disconnect. Never enumerate unrelated accounts.
  const rows = await prisma.coupleMember.findMany({ where: {
    userId: { not: user.id }, couple: { members: { some: { userId: user.id } } },
  }, distinct: ["userId"], select: { userId: true }, take: 100 });
  return rows.map((row) => ({ id: row.userId }));
}

export async function submitAccountReport(input: unknown) {
  const user = await requireUser();
  const data = accountReportSchema.parse(input);
  return serializable(async (tx) => {
    await lockVerifiedUser(tx, user.id);
    const relationship = data.targetId !== user.id && await tx.coupleMember.findFirst({ where: {
      userId: data.targetId, couple: { members: { some: { userId: user.id } } },
    }, select: { id: true } });
    if (!relationship) throw new AuthorizationError("You can report only an account you have shared a space with.");
    const duplicate = await tx.accountReport.findFirst({ where: { reporterId: user.id, targetId: data.targetId, status: "OPEN" }, select: { id: true } });
    if (duplicate) throw new ConflictError("Your report for this account is already awaiting review.");
    const recent = await tx.accountReport.count({ where: { reporterId: user.id, createdAt: { gt: new Date(Date.now() - 86400_000) } } });
    if (recent >= 5) throw new ConflictError("You can submit up to five reports in 24 hours. Please try again later.");
    return tx.accountReport.create({ data: { ...data, reporterId: user.id }, select: { id: true } });
  });
}

export async function reviewAccountReport(input: unknown) {
  await requireAdmin();
  const data = reviewReportSchema.parse(input);
  return serializable(async (tx) => {
    const admin = await requireAdmin(tx);
    const report = await tx.accountReport.findUnique({ where: { id: data.reportId } });
    if (!report) throw new NotFoundError();
    if (report.status !== "OPEN") throw new ConflictError("This report has already been reviewed.");
    if (data.status === "ACTIONED" && !await tx.moderationAudit.findFirst({ where: {
      targetId: report.targetId, action: { in: ["DELETE", "BLOCK_EMAIL"] }, createdAt: { gte: report.createdAt },
    }, select: { id: true } })) throw new ConflictError("Take an account action before marking this report as action taken.");
    await tx.accountReport.update({ where: { id: report.id }, data: {
      status: data.status, reviewedAt: new Date(), reviewedById: admin.id, reviewNote: data.reason,
    } });
    await tx.moderationAudit.create({ data: {
      actorId: admin.id, targetId: report.targetId, action: `REPORT_${data.status}`, reason: data.reason, reportId: report.id,
    } });
  });
}

/** Revocation is committed with a block, so already signed cookies cannot restore access. */
async function revokeAccountAccess(tx: Prisma.TransactionClient, userId: string, now: Date) {
  await tx.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
  await tx.passwordResetToken.deleteMany({ where: { userId } });
  await tx.emailVerificationToken.deleteMany({ where: { userId } });
  await tx.pushSubscription.deleteMany({ where: { userId } });
  await tx.notificationPreference.updateMany({ where: { userId }, data: { pushEnabled: false, pushSubscription: Prisma.DbNull } });
  await tx.notificationDelivery.updateMany({ where: { userId, status: { in: ["PENDING", "PROCESSING"] } },
    data: { status: "CANCELLED", leaseToken: null, leaseUntil: null, lastError: "account_blocked" } });
  await tx.coupleInvitation.updateMany({ where: { createdById: userId, acceptedAt: null, revokedAt: null }, data: { revokedAt: now } });
}

export async function moderateAccount(input: unknown) {
  await requireAdmin();
  const data = moderationSchema.parse(input);
  return serializable(async (tx) => {
    const admin = await requireAdmin(tx);
    const target = await tx.user.findUnique({ where: { id: data.targetId }, select: {
      id: true, email: true, moderationEmailHash: true, deletedAt: true, avatarKey: true,
    } });
    if (!target) throw new NotFoundError("Account not found.");
    const hash = target.moderationEmailHash ?? emailFingerprint(target.email);
    await lockRegistrationEmail(tx, hash);
    // Include a new account registered with a previously deleted account's email.
    const affected = await tx.user.findMany({ where: { OR: [
      { id: target.id }, { moderationEmailHash: hash, deletedAt: null },
    ] }, orderBy: { id: "asc" }, select: { id: true } });
    for (const account of affected) {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${account.id} FOR UPDATE`;
      if (account.id === admin.id || await tx.adminAccess.findUnique({ where: { userId: account.id } })) {
        throw new AuthorizationError("Admin accounts cannot be moderated from this panel.");
      }
    }
    const now = new Date();
    if (data.action === "DELETE") {
      if (target.deletedAt) throw new ConflictError("This account has already been deleted.");
      await deleteAccountInTransaction(tx, target.id);
      if (target.avatarKey) await tx.storageCleanup.upsert({ where: { key: target.avatarKey },
        create: { key: target.avatarKey }, update: { failedAt: null, nextAttemptAt: now } });
      // Keep only a fingerprint for subsequent email blocking; self-deletion semantics stay unchanged.
      await tx.user.update({ where: { id: target.id }, data: {
        moderationEmailHash: hash, email: `deleted-${target.id}@accounts.invalid`, emailVerified: null,
        avatarUrl: null, avatarKey: null, birthday: null, pronouns: null,
      } });
    } else if (data.action === "BLOCK_EMAIL") {
      await tx.emailBlock.upsert({ where: { emailHash: hash }, create: {
        emailHash: hash, accountId: target.id, blockedById: admin.id, reason: data.reason,
      }, update: { blockedById: admin.id, reason: data.reason } });
      for (const account of affected) {
        await revokeAccountAccess(tx, account.id, now);
        await tx.user.update({ where: { id: account.id }, data: {
          blockedAt: now, moderationEmailHash: hash, tokenVersion: { increment: 1 },
        } });
      }
    } else {
      await tx.emailBlock.deleteMany({ where: { emailHash: hash } });
      await tx.user.updateMany({ where: { moderationEmailHash: hash }, data: { blockedAt: null } });
    }
    await tx.moderationAudit.create({ data: {
      actorId: admin.id, targetId: target.id, action: data.action, reason: data.reason,
    } });
  });
}
