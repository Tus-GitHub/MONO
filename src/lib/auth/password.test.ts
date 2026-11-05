import { expect, it } from "vitest";
import { passwordSchema } from "./password";

it("bounds every new-password flow to bcrypt's 72 UTF-8 bytes", () => {
  expect(passwordSchema.safeParse(`Aa1${"x".repeat(69)}`).success).toBe(true);
  expect(passwordSchema.safeParse(`Aa1${"x".repeat(70)}`).success).toBe(false);
  expect(passwordSchema.safeParse(`Aa1${"é".repeat(34)}`).success).toBe(true);
  expect(passwordSchema.safeParse(`Aa1${"é".repeat(35)}`).success).toBe(false);
});
