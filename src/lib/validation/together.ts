import { z } from "zod";
import { MiniGameKind } from "@prisma/client";
import { arcadeMove } from "@/lib/together/arcade-state";
import { idSchema } from "./common";
export const sequenceSchema = z.string().regex(/^\d{1,19}$/).transform(BigInt).refine((value) => value <= BigInt("9223372036854775807"));
const nonce = z.string().uuid();
export const gameMoveSchema = z.union([arcadeMove, z.object({ type: z.literal("token"), token: z.number().int().min(0).max(3) })]);
export const gameActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), kind: z.nativeEnum(MiniGameKind), clientNonce: nonce }),
  z.object({ action: z.literal("accept"), id: idSchema, version: z.number().int().nonnegative() }),
  z.object({ action: z.literal("decline"), id: idSchema, version: z.number().int().nonnegative() }),
  z.object({ action: z.literal("cancel"), id: idSchema, version: z.number().int().nonnegative() }),
  z.object({ action: z.literal("resign"), id: idSchema, version: z.number().int().nonnegative() }),
  z.object({ action: z.literal("move"), id: idSchema, version: z.number().int().nonnegative(), move: gameMoveSchema }),
]);
export const presenceSchema = z.object({ sequence: sequenceSchema, typing: z.boolean().default(false) });
const sdp = (type: "offer" | "answer") => z.object({ type: z.literal(type), sdp: z.string().min(1).max(90_000) });
export const signalSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("offer"), payload: sdp("offer") }), z.object({ kind: z.literal("answer"), payload: sdp("answer") }),
  z.object({ kind: z.literal("ice"), payload: z.object({ candidate: z.string().max(4096), sdpMid: z.string().max(100).nullish(), sdpMLineIndex: z.number().int().min(0).max(100).nullish(), usernameFragment: z.string().max(256).nullish() }) }),
]);
export const callActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), kind: z.enum(["AUDIO", "VIDEO"]), clientNonce: nonce }),
  z.object({ action: z.literal("accept"), id: idSchema }),
  z.object({ action: z.literal("decline"), id: idSchema }),
  z.object({ action: z.literal("end"), id: idSchema }),
  z.object({ action: z.literal("heartbeat"), id: idSchema }),
  z.object({ action: z.literal("video"), id: idSchema }),
  z.object({ action: z.literal("signal"), id: idSchema, signal: signalSchema }),
]);
