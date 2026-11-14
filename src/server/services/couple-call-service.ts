import "server-only";
import { Prisma, type CoupleCall } from "@prisma/client";
import { z } from "zod";
import { env } from "@/config/env";
import { prisma } from "@/lib/db/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { callActionSchema } from "@/lib/validation/together";
import type { CallDTO, SignalDTO } from "@/lib/together/types";
import { requireTogether, withTogetherWrite } from "./together-context";

export function effectiveCallStatus(call: CoupleCall, now = Date.now()): CallDTO["status"] {
  if (call.status === "RINGING" && now - call.createdAt.getTime() > 60_000) return "MISSED";
  if (call.status === "ACCEPTED" && (now - call.callerSeenAt.getTime() > 90_000 || now - (call.calleeSeenAt?.getTime() ?? 0) > 90_000)) return "ENDED";
  return call.status;
}
const callDTO = (row: CoupleCall): CallDTO => ({ id: row.id, callerId: row.callerId, calleeId: row.calleeId, kind: row.kind,
  status: effectiveCallStatus(row), createdAt: row.createdAt.toISOString(), acceptedAt: row.acceptedAt?.toISOString() ?? null });
export async function togetherStatus() {
  const context = await requireTogether(), { couple, user } = context;
  const [state, calls] = await Promise.all([
    prisma.chatMemberState.findUnique({ where: { coupleId_userId: { coupleId: couple.id, userId: user.id } }, select: { lastRead: true } }),
    prisma.coupleCall.findMany({ where: { coupleId: couple.id, status: { in: ["RINGING", "ACCEPTED"] } }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const unread = await prisma.chatMessage.count({ where: { coupleId: couple.id, senderId: { not: user.id }, sequence: { gt: state?.lastRead ?? BigInt(0) } } });
  // Expired signaling is not chat history. Purge network negotiation data on foreground checks.
  await prisma.callSignal.deleteMany({ where: { call: { coupleId: couple.id }, createdAt: { lt: new Date(Date.now() - 5 * 60_000) } } });
  const active = calls.find((call) => ["RINGING", "ACCEPTED"].includes(effectiveCallStatus(call)));
  return { unread, partner: context.partner, call: active ? callDTO(active) : null };
}
export function callIceServers(): RTCIceServer[] {
  if (!env.COUPLE_ICE_SERVERS) return [{ urls: "stun:stun.l.google.com:19302" }];
  const urls = z.union([z.string(), z.array(z.string()).min(1).max(4)]).refine((value) => (Array.isArray(value) ? value : [value]).every((url) => /^(stun|stuns|turn|turns):[^\s]{1,500}$/.test(url)));
  try { return z.array(z.object({ urls, username: z.string().max(500).optional(), credential: z.string().max(1000).optional() })).min(1).max(8).parse(JSON.parse(env.COUPLE_ICE_SERVERS)); }
  catch { throw new ValidationError("Calling is temporarily unavailable because its network configuration needs attention."); }
}
export async function getCall(id: string, after = BigInt(0)) {
  const context = await requireTogether();
  const call = await prisma.coupleCall.findFirst({ where: { id, coupleId: context.couple.id, OR: [{ callerId: context.user.id }, { calleeId: context.user.id }] } });
  if (!call) throw new NotFoundError();
  const active = ["RINGING", "ACCEPTED"].includes(effectiveCallStatus(call));
  const signals = active ? await prisma.callSignal.findMany({ where: { callId: id, senderId: { not: context.user.id }, id: { gt: after } }, orderBy: { id: "asc" }, take: 100 }) : [];
  return { call: callDTO(call), signals: signals.map((signal) => ({ id: String(signal.id), kind: signal.kind, payload: signal.payload })) as SignalDTO[] };
}
export async function actOnCall(value: unknown): Promise<CallDTO> {
  const input = callActionSchema.parse(value), context = await requireTogether();
  const row = await withTogetherWrite(context, async (tx) => {
    const now = new Date();
    if (input.action === "start") {
      const duplicate = await tx.coupleCall.findUnique({ where: { callerId_clientNonce: { callerId: context.user.id, clientNonce: input.clientNonce } } });
      if (duplicate) { if (duplicate.coupleId !== context.couple.id) throw new ConflictError("Start a new call."); return duplicate; }
      const previous = await tx.coupleCall.findMany({ where: { coupleId: context.couple.id, status: { in: ["RINGING", "ACCEPTED"] } } });
      for (const call of previous) {
        const status = effectiveCallStatus(call);
        if (status === "RINGING" || status === "ACCEPTED") throw new ConflictError(call.callerId === context.user.id ? "You already have a call open." : "Your partner is already calling. Accept their call instead.");
        await tx.coupleCall.update({ where: { id: call.id }, data: { status, endedAt: now } });
        await tx.callSignal.deleteMany({ where: { callId: call.id } });
      }
      if (await tx.coupleCall.count({ where: { callerId: context.user.id, createdAt: { gt: new Date(Date.now() - 60_000) } } }) >= 6) throw new ValidationError("Wait a moment before calling again.");
      return tx.coupleCall.create({ data: { coupleId: context.couple.id, callerId: context.user.id, calleeId: context.partner.id, kind: input.kind, clientNonce: input.clientNonce } });
    }
    const call = await tx.coupleCall.findFirst({ where: { id: input.id, coupleId: context.couple.id } });
    if (!call || ![call.callerId, call.calleeId].includes(context.user.id)) throw new NotFoundError();
    const status = effectiveCallStatus(call);
    if (input.action === "end" || input.action === "decline") {
      if (input.action === "decline" && (context.user.id !== call.calleeId || status !== "RINGING")) throw new ValidationError("This call cannot be declined now.");
      if (!["RINGING", "ACCEPTED"].includes(status)) return { ...call, status };
      const result = await tx.coupleCall.update({ where: { id: call.id }, data: { status: input.action === "decline" ? "DECLINED" : "ENDED", endedAt: now } });
      await tx.callSignal.deleteMany({ where: { callId: call.id } }); return result;
    }
    if (input.action === "accept") {
      if (context.user.id !== call.calleeId || status !== "RINGING") throw new ValidationError("This call has ended or was already answered.");
      return tx.coupleCall.update({ where: { id: call.id }, data: { status: "ACCEPTED", acceptedAt: now, calleeSeenAt: now } });
    }
    if (status !== "RINGING" && status !== "ACCEPTED") throw new ValidationError("This call has ended.");
    if (input.action === "video") {
      if (status !== "ACCEPTED") throw new ValidationError("Wait until your partner answers before switching to video or sharing your screen.");
      return tx.coupleCall.update({ where: { id: call.id }, data: { kind: "VIDEO" } });
    }
    if (input.action === "heartbeat") return tx.coupleCall.update({ where: { id: call.id }, data: context.user.id === call.callerId ? { callerSeenAt: now } : { calleeSeenAt: now } });
    if (input.action === "signal") {
      if ((input.signal.kind === "offer" && context.user.id !== call.callerId) || (input.signal.kind === "answer" && (context.user.id !== call.calleeId || status !== "ACCEPTED"))) throw new ValidationError("This call signal isn't allowed.");
      if (await tx.callSignal.count({ where: { callId: call.id } }) >= 512) throw new ValidationError("The call could not connect. Start a new call.");
      if (input.signal.kind !== "ice" && await tx.callSignal.findFirst({ where: { callId: call.id, kind: input.signal.kind } })) throw new ConflictError("This call was already negotiated.");
      await tx.callSignal.create({ data: { callId: call.id, senderId: context.user.id, kind: input.signal.kind, payload: input.signal.payload as Prisma.InputJsonValue } });
    }
    return call;
  });
  return callDTO(row);
}
