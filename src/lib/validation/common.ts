import { z } from "zod";

/** cuid-shaped identifier. Never trust this alone for authorization — see src/lib/authz. */
export const idSchema = z
  .string()
  .trim()
  .min(1, "Missing identifier.")
  .max(64)
  .regex(/^[a-z0-9_-]+$/i, "Malformed identifier.");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(320)
  .email("Enter a valid email address.");

export function requiredText(label: string, max = 500) {
  return z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);
}

export function optionalText(max = 500) {
  return z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));
}

/** Whole non-negative amount in minor units (cents). */
export const amountCentsSchema = z.coerce
  .number()
  .int("Use a whole number.")
  .nonnegative("Cannot be negative.")
  .max(100_000_000, "That amount is too large.");

/** ISO-4217 currency code. */
export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(3, "Use a 3-letter currency code.");

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  take: z.coerce.number().int().min(1).max(100).default(20),
});

/** Flatten a ZodError into the `{ field: string[] }` shape used by ActionState/forms. */
export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const flattened = error.flatten();
  const result: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(flattened.fieldErrors)) {
    if (messages && messages.length) result[key] = messages;
  }
  if (flattened.formErrors.length) result._form = flattened.formErrors;
  return result;
}
