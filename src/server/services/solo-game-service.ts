import "server-only";
import { randomInt } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/config/env";
import { prisma } from "@/lib/db/prisma";
import { ValidationError } from "@/lib/errors";
import { replaySolo } from "@/lib/solo-games/replay";
import { SOLO_KINDS, type SoloChallenge, type SoloScore } from "@/lib/solo-games/catalog";
import { soloActionSchema, soloKindSchema } from "@/lib/validation/solo-games";
import { rateLimit } from "@/lib/security/rate-limit";
import { bumpTogether, requireTogether, withTogetherWrite } from "./together-context";

const audience = "amor-solo-games-v1";
const key = () => new TextEncoder().encode(env.AUTH_SECRET);
export async function getSoloGameSummary() {
  const { couple, user, partner } = await requireTogether();
  const rows = await prisma.soloGameScore.findMany({ where: { coupleId: couple.id, userId: { in: [user.id, partner.id] } }, select: { kind: true, userId: true, bestScore: true } });
  return { userId: user.id, userName: user.name, partnerName: partner.name,
    scores: rows.filter(row => SOLO_KINDS.includes(row.kind as SoloScore["kind"])) as SoloScore[] };
}

export async function actOnSoloGame(value: unknown): Promise<SoloChallenge | { bestScore: number; score: number }> {
  const input = soloActionSchema.parse(value), context = await requireTogether();
  if (!rateLimit(`solo:${context.user.id}`, 120, 60_000).ok) throw new ValidationError("Take a short break, then try again.");
  if (input.action === "start") {
    const seed = randomInt(0, 2 ** 32);
    const token = await new SignJWT({ seed, kind: input.kind, coupleId: context.couple.id })
      .setProtectedHeader({ alg: "HS256" }).setSubject(context.user.id).setAudience(audience).setIssuedAt().setExpirationTime("24h").sign(key());
    return { token, seed, kind: input.kind };
  }
  let seed: number, kind: SoloScore["kind"];
  try {
    const { payload } = await jwtVerify(input.token, key(), { algorithms: ["HS256"], audience });
    if (payload.sub !== context.user.id || payload.coupleId !== context.couple.id || !Number.isInteger(payload.seed)
      || (payload.seed as number) < 0 || (payload.seed as number) >= 2 ** 32) throw new Error("Invalid round");
    seed = payload.seed as number; kind = soloKindSchema.parse(payload.kind);
  } catch { throw new ValidationError("This round has expired. Start a new game to save another score."); }
  let score: number;
  try { score = replaySolo(kind, seed, input); }
  catch { throw new ValidationError("This round could not be verified. Start a new game."); }
  const bestScore = await withTogetherWrite(context, async tx => {
    const id = { coupleId: context.couple.id, userId: context.user.id, kind };
    const existing = await tx.soloGameScore.findUnique({ where: { coupleId_userId_kind: id } });
    if (existing && existing.bestScore >= score) return existing.bestScore;
    await tx.soloGameScore.upsert({ where: { coupleId_userId_kind: id }, create: { ...id, bestScore: score }, update: { bestScore: score } });
    await bumpTogether(tx, context.couple.id);
    return score;
  });
  return { score, bestScore };
}
