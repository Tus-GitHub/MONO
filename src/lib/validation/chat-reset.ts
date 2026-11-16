import { z } from "zod";
import { chatKeyIdSchema } from "./chat-security";
export const chatResetActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request"), keyId: chatKeyIdSchema }).strict(),
  z.object({ action: z.literal("confirm"), requestId: z.string().uuid(),
    ownCode: z.string().regex(/^\d{6}$/, "Enter your six-digit email code."),
    partnerCode: z.string().regex(/^\d{6}$/, "Enter your partner's six-digit email code."),
    acknowledged: z.literal(true),
  }).strict(),
  z.object({ action: z.literal("cancel"), requestId: z.string().uuid() }).strict(),
]);
export interface ChatResetDelivery { requestId: string; ownEmail: string; partnerEmail: string; expiresAt: string; resendAt: string }
