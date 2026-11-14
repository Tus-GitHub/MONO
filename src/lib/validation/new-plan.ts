import { z } from "zod";
import { ExpensePayer } from "@prisma/client";
import { selectPlaceSchema } from "./place";

export const localPlanSchema = z.object({
  key: z.string().max(36), title: z.string().max(160), category: z.string().max(24),
  date: z.string().max(10), startTime: z.string().max(5), endTime: z.string().max(5), notes: z.string().max(4000),
  expectedTotal: z.string().max(20), budgetMin: z.string().max(20), budgetMax: z.string().max(20),
  currency: z.string().max(3), split: z.nativeEnum(ExpensePayer),
  place: z.object({ selection: selectPlaceSchema, name: z.string().max(160), city: z.string().max(120).nullish(),
    address: z.string().max(500).nullish(), imageUrl: z.string().max(4000).nullish() }).nullable(),
  activities: z.array(z.object({ key: z.string().max(50), title: z.string().max(120), duration: z.string().max(4), cost: z.string().max(20), savedPlaceId: z.string().max(128) })).max(40),
});
export type LocalPlan = z.infer<typeof localPlanSchema>;
export type LocalPlaceChoice = NonNullable<LocalPlan["place"]>;
