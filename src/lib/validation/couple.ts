import { z } from "zod";

import { emailSchema, optionalText } from "@/lib/validation/common";

const optionalDate = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.coerce.date().optional(),
);

export const createCoupleSchema = z.object({
  name: optionalText(80),
  anniversaryAt: optionalDate,
  timezone: z.string().trim().max(64).optional(),
  currency: z.string().trim().toUpperCase().length(3).optional(),
});

export const joinCoupleSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(4, "Enter the full invite code.")
    .max(16)
    .transform((value) => value.replace(/\s+/g, "")),
});

/** Couple-setup step: name, description, relationship date (photo is uploaded separately). */
export const coupleSetupSchema = z.object({
  name: optionalText(80),
  description: optionalText(500),
  anniversaryAt: optionalDate,
});

export const createInvitationSchema = z.object({
  email: z.preprocess((value) => (value ? value : undefined), emailSchema.optional()),
});

export const acceptInvitationSchema = z.object({
  token: z.string().trim().min(10, "That invitation link is not valid.").max(200),
});

export type CreateCoupleInput = z.infer<typeof createCoupleSchema>;
export type JoinCoupleInput = z.infer<typeof joinCoupleSchema>;
export type CoupleSetupInput = z.infer<typeof coupleSetupSchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
