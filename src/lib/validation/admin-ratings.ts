import { z } from "zod";

export const adminRatingsQuerySchema = z.object({
  venueQuery: z.string().trim().max(120).default("").catch(""),
  page: z.coerce.number().int().min(1).max(10000).default(1).catch(1),
});
