import "server-only";
import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { env } from "@/config/env";
import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email";
import { chatResetEmail } from "@/lib/email/templates";
import { AuthorizationError, ValidationError } from "@/lib/errors";
import { chatResetActionSchema, type ChatResetDelivery } from "@/lib/validation/chat-reset";
import { requireTogether, withTogetherWrite, type TogetherContext } from "./together-context";
import { erasePreviousChat } from "./chat-reset-cleanup-service";

const TTL = 10 * 60_000, COOLDOWN = 60_000, WINDOW = 60 * 60_000, ATTEMPTS = 5;
const invalid = "Both codes must match this request and be unexpired. Request new codes if needed.";
// Invalidate older retention-only approvals: those emails never consented to deletion.
const digest = (...parts: string[]) => createHmac("sha256", env.AUTH_SECRET).update(JSON.stringify(["amor-chat-reset-delete-v2", ...parts])).digest("hex");
const equal = (left: string, right: string) => timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
const mask = (email: string) => { const [local, domain] = email.split("@"); return `${local.slice(0, 1)}•••@${domain}`; };
async function people(tx: Prisma.TransactionClient, context: TogetherContext) {
  const rows = await tx.user.findMany({ where: { id: { in: [context.user.id, context.partner.id] }, deletedAt: null, blockedAt: null, emailVerified: { not: null } }, select: { id: true, name: true, email: true } });
  const own = rows.find(row => row.id === context.user.id), partner = rows.find(row => row.id === context.partner.id);
  if (!own || !partner || !own.email || !partner.email || own.email === partner.email) throw new AuthorizationError("Both partners need verified, separate email addresses to reset chat.");
  return { own, partner };
}
export async function actOnChatReset(value: unknown): Promise<ChatResetDelivery | { reset: true; keyId: string; cleanupCoupleId: string } | { cancelled: true }> {
  const input = chatResetActionSchema.parse(value), context = await requireTogether();
  if (input.action === "request") {
    const requestId = randomUUID(), ownNumber = randomInt(0, 1_000_000), otherNumber = randomInt(0, 999_999);
    const ownCode = String(ownNumber).padStart(6, "0"), partnerCode = String(otherNumber >= ownNumber ? otherNumber + 1 : otherNumber).padStart(6, "0");
    const delivery = await withTogetherWrite(context, async tx => {
      const accounts = await people(tx, context);
      const couple = await tx.couple.findUniqueOrThrow({ where: { id: context.couple.id } });
      if (!couple.chatKeyId || couple.chatKeyId === input.keyId) throw new ValidationError("Use a new recovery code to reset an existing encrypted chat.");
      const old = await tx.chatResetRequest.findUnique({ where: { coupleId: couple.id } }), now = new Date();
      if (old && now.getTime() - old.requestedAt.getTime() < COOLDOWN) throw new ValidationError("Wait one minute before requesting new codes.");
      const inWindow = old && now.getTime() - old.windowStartedAt.getTime() < WINDOW;
      if (inWindow && old.windowCount >= 3) throw new ValidationError("Three reset requests have been sent. Try again in an hour.");
      const data = { requestId, requestedById: accounts.own.id, partnerId: accounts.partner.id, generation: couple.chatGeneration, newKeyId: input.keyId,
        requesterEmailHash: digest("mailbox", accounts.own.email), partnerEmailHash: digest("mailbox", accounts.partner.email),
        requesterOtpHash: digest(requestId, accounts.own.id, input.keyId, ownCode), partnerOtpHash: digest(requestId, accounts.partner.id, input.keyId, partnerCode),
        requestedAt: now, expiresAt: new Date(now.getTime() + TTL), sentAt: null, usedAt: null, attempts: 0,
        windowStartedAt: inWindow ? old.windowStartedAt : now, windowCount: inWindow ? old.windowCount + 1 : 1 };
      await tx.chatResetRequest.upsert({ where: { coupleId: couple.id }, create: { coupleId: couple.id, ...data }, update: data });
      return { ...accounts, expiresAt: data.expiresAt, requestedAt: now };
    });
    const emails = await Promise.allSettled([delivery.own, delivery.partner].map((person, index) => sendEmail(chatResetEmail({ to: person.email, name: person.name,
      code: index === 0 ? ownCode : partnerCode, requesterName: delivery.own.name, reference: requestId.slice(0, 8), chatUrl: new URL("/chat", env.APP_URL).toString() }))));
    if (emails.some(result => result.status === "rejected")) {
      // Keep the shared cooldown even when SMTP acceptance is uncertain. Neither code is usable.
      throw new ValidationError("Could not send both emails. Chat is unchanged. Wait one minute, then request new codes.");
    }
    const ready = await prisma.chatResetRequest.updateMany({ where: { coupleId: context.couple.id, requestId, usedAt: null, expiresAt: { gt: new Date() } }, data: { sentAt: new Date() } });
    if (ready.count !== 1) throw new ValidationError("This request is no longer active. Chat is unchanged.");
    return { requestId, ownEmail: mask(delivery.own.email), partnerEmail: mask(delivery.partner.email), expiresAt: delivery.expiresAt.toISOString(), resendAt: new Date(delivery.requestedAt.getTime() + COOLDOWN).toISOString() };
  }
  const result = await withTogetherWrite(context, async tx => {
    const accounts = await people(tx, context), now = new Date();
    const record = await tx.chatResetRequest.findUnique({ where: { coupleId: context.couple.id } });
    if (!record || record.requestId !== input.requestId || record.requestedById !== accounts.own.id || record.partnerId !== accounts.partner.id) return { error: invalid };
    if (input.action === "cancel") {
      if (!record.usedAt) await tx.chatResetRequest.update({ where: { coupleId: record.coupleId }, data: { usedAt: now } });
      return { cancelled: true as const };
    }
    const couple = await tx.couple.findUniqueOrThrow({ where: { id: context.couple.id } });
    if (!record.sentAt || record.usedAt || record.expiresAt <= now || record.attempts >= ATTEMPTS || record.generation !== couple.chatGeneration
      || record.requesterEmailHash !== digest("mailbox", accounts.own.email) || record.partnerEmailHash !== digest("mailbox", accounts.partner.email)) return { error: invalid };
    // Compute both comparisons. Never reveal whether one individual code was correct.
    const ownValid = equal(record.requesterOtpHash, digest(record.requestId, accounts.own.id, record.newKeyId, input.ownCode));
    const partnerValid = equal(record.partnerOtpHash, digest(record.requestId, accounts.partner.id, record.newKeyId, input.partnerCode));
    if (!ownValid || !partnerValid) {
      await tx.chatResetRequest.update({ where: { coupleId: record.coupleId }, data: { attempts: { increment: 1 } } });
      return { error: record.attempts + 1 >= ATTEMPTS ? "Too many incorrect attempts. Request new codes." : invalid };
    }
    // Deletion, key switch and single-use consumption either all commit or all roll back.
    await erasePreviousChat(tx, record.coupleId, record.generation, now);
    await tx.chatResetRequest.update({ where: { coupleId: record.coupleId }, data: { usedAt: now } });
    await tx.couple.update({ where: { id: record.coupleId }, data: { chatKeyId: record.newKeyId, chatGeneration: { increment: 1 }, togetherRevision: { increment: 1 } } });
    await tx.chatMemberState.updateMany({ where: { coupleId: record.coupleId }, data: { typingUntil: null, lastRead: BigInt(0) } });
    return { reset: true as const, keyId: record.newKeyId, cleanupCoupleId: record.coupleId };
  });
  // Throw outside the transaction so failed-attempt counters are committed.
  if ("error" in result) throw new ValidationError(result.error);
  return result;
}
