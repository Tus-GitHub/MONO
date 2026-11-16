import { z } from "zod";
import { idSchema } from "./common";
import { signalSchema } from "./together";
export const gameChatSignalSchema = z.object({
  gameId: idSchema, sessionId: z.string().uuid(), targetSessionId: z.string().uuid().optional(),
  signal: z.union([z.object({ kind: z.literal("hello"), payload: z.object({}).strict() }), signalSchema]),
}).superRefine((value, context) => {
  if (value.signal.kind !== "hello" && !value.targetSessionId) context.addIssue({ code: "custom", path: ["targetSessionId"], message: "Choose the current peer session." });
});
