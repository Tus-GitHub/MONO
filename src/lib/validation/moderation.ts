import { z } from "zod";
import { idSchema } from "@/lib/validation/common";

export const reportCategories = ["Harassment", "Threats or abuse", "Spam or scam", "Impersonation", "Other"] as const;
export const accountReportSchema = z.object({
  targetId: idSchema,
  category: z.enum(reportCategories),
  details: z.string().trim().min(10, "Describe what happened (at least 10 characters).").max(2000),
});
export const moderationSchema = z.object({
  targetId: idSchema,
  confirmation: idSchema,
  action: z.enum(["DELETE", "BLOCK_EMAIL", "UNBLOCK_EMAIL"]),
  reason: z.string().trim().min(10, "Record your reason (at least 10 characters).").max(1000),
}).refine((value) => value.targetId === value.confirmation, {
  message: "Enter the exact account ID to confirm.", path: ["confirmation"],
});
export const reviewReportSchema = z.object({
  reportId: idSchema,
  status: z.enum(["DISMISSED", "ACTIONED"]),
  reason: z.string().trim().min(10, "Record your review (at least 10 characters).").max(1000),
});
export const adminQuerySchema = z.object({
  view: z.enum(["couples", "accounts", "ratings", "archives"]).default("couples").catch("couples"),
  page: z.coerce.number().int().min(1).max(10000).default(1).catch(1),
  query: z.string().trim().max(64).regex(/^[a-z0-9_-]*$/i).default("").catch(""),
  reportStatus: z.enum(["OPEN", "DISMISSED", "ACTIONED"]).default("OPEN").catch("OPEN"),
});
