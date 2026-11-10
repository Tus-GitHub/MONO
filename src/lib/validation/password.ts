import { z } from "zod";

/** Shared password rules, safe to use in forms without importing the hashing library. */
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200, "That password is too long.")
  .regex(/[a-z]/, "Include a lowercase letter.")
  .regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/[0-9]/, "Include a number.")
  .refine((value) => new TextEncoder().encode(value).byteLength <= 72, "Use at most 72 bytes for your password.");

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(200),
  password: passwordSchema,
  confirmPassword: z.string().min(1, "Confirm your new password."),
}).refine((input) => input.password === input.confirmPassword, {
  message: "Passwords do not match.", path: ["confirmPassword"],
});
