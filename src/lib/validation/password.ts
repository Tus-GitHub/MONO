import { z } from "zod";

/** Shared password rules, safe to use in forms without importing the hashing library. */
export const passwordSchema = z
  .string()
  .min(6, "Use at least 6 characters.")
  .max(200, "That password is too long.")
  .refine((value) => new TextEncoder().encode(value).byteLength <= 72, "Use at most 72 bytes for your password.");

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(200),
  password: passwordSchema,
  confirmPassword: z.string().min(1, "Confirm your new password."),
}).refine((input) => input.password === input.confirmPassword, {
  message: "Passwords do not match.", path: ["confirmPassword"],
});
