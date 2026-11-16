import { z } from "zod";
import { MAX_SOLO_FRAMES } from "@/lib/solo-games/catalog";
export const soloKindSchema = z.enum(["EMOJI_BOUNCE", "SNAKE", "MERGE_2048"]);
export const soloRulesVersionSchema = z.union([z.literal(1), z.literal(2)]);
export const soloReplaySchema = z.object({ frames: z.number().int().min(0).max(MAX_SOLO_FRAMES),
  moves: z.array(z.tuple([z.number().int().min(0).max(MAX_SOLO_FRAMES), z.number().int().min(0).max(360)])).max(MAX_SOLO_FRAMES),
}).strict();
export const soloActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), kind: soloKindSchema, rulesVersion: soloRulesVersionSchema.optional() }).strict(),
  soloReplaySchema.extend({ action: z.literal("save"), token: z.string().min(1).max(2048) }).strict(),
]);
