import { z } from "zod";
import { idSchema } from "./common";
export const chatKeyIdSchema = z.string().regex(/^[a-f0-9]{64}$/);
const encoded = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/);
export const encryptedBodySchema = z.string().max(24000).superRefine((body, ctx) => {
  try {
    const value = JSON.parse(body);
    if (!z.object({ v: z.literal(1), keyId: chatKeyIdSchema, iv: encoded.length(16), data: encoded.min(24).max(22000) }).strict().safeParse(value).success) throw new Error();
  } catch { ctx.addIssue({ code: "custom", message: "Send an encrypted message from an updated MONO app." }); }
});
export const secureMessageSchema = z.object({ kind: z.enum(["TEXT", "STICKER"]), body: encryptedBodySchema, clientNonce: z.string().uuid() });
export const encryptedImageSchema = z.object({ clientNonce: z.string().uuid(), keyId: chatKeyIdSchema, iv: encoded.length(16), data: encoded.min(24).max(710000), width: z.number().int().min(1).max(4096), height: z.number().int().min(1).max(4096), viewLimit: z.union([z.literal(0), z.literal(1), z.literal(2)]) });
export const chatActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("edit"), id: idSchema, version: z.number().int().nonnegative(), body: encryptedBodySchema }),
  z.object({ action: z.literal("delete-me"), id: idSchema }),
  z.object({ action: z.literal("delete-everyone"), id: idSchema }),
]);
export const migrateChatSchema = z.object({ id: idSchema, version: z.number().int().nonnegative(), body: encryptedBodySchema, image: encryptedImageSchema.omit({ clientNonce: true, viewLimit: true }).optional() });
