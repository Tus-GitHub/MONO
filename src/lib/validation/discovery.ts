import { z } from "zod";
import { exploreCategoryByKey } from "@/lib/date/explore-categories";

export const discoveryCategorySchema = z.string().max(24).refine(
  (key) => key === "all" || exploreCategoryByKey(key)?.kind === "category", "Choose a valid plan category.",
);
