import { z } from "zod";

import { optionalText } from "@/lib/validation/common";
import { THEMES } from "@/lib/settings/theme";

const optionalDate = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.coerce.date().optional(),
);

/** Couple profile edit — name, description, relationship date, spending currency. */
export const coupleProfileSchema = z.object({
  name: optionalText(80),
  description: optionalText(500),
  anniversaryAt: optionalDate,
  currency: z.string().trim().toUpperCase().length(3, "Use a 3-letter currency code."),
});

export const userSettingsSchema = z.object({
  theme: z.enum(THEMES),
  hideMoneyInsights: z.boolean(),
  hidePartnerPreferenceGap: z.boolean(),
});

export const themeSchema = z.object({ theme: z.enum(THEMES) });

/** Deleting your account is gated on typing the word. */
export const deleteAccountSchema = z.object({
  confirm: z.literal("DELETE", { message: 'Type "DELETE" to confirm.' }),
});

export type CoupleProfileInput = z.infer<typeof coupleProfileSchema>;
export type UserSettingsInput = z.infer<typeof userSettingsSchema>;
