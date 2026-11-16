import { z } from "zod";
import { idSchema } from "./common";
import { chatKeyIdSchema, encryptedBodySchema } from "./chat-security";
import { VIDEO_MAX_BYTES } from "@/lib/together/video-policy";
export const videoStartSchema = z.object({
  action: z.literal("start"), clientNonce: z.string().uuid(), keyId: chatKeyIdSchema,
  body: encryptedBodySchema, byteLength: z.number().int().positive().max(VIDEO_MAX_BYTES),
}).strict();
export const videoActionSchema = z.discriminatedUnion("action", [videoStartSchema,
  z.object({ action: z.literal("part"), id: idSchema, index: z.number().int().min(0).max(511),
    iv: z.string().regex(/^[A-Za-z0-9+/]{16}$/), data: z.string().max(1398136).regex(/^[A-Za-z0-9+/]+={0,2}$/) }).strict(),
  z.object({ action: z.literal("finish"), id: idSchema }).strict(),
  z.object({ action: z.literal("cancel"), id: idSchema }).strict(),
]);
