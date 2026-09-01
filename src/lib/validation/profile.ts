import { z } from "zod";

import { optionalText, requiredText } from "@/lib/validation/common";

const optionalPastDate = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.coerce
    .date()
    .max(new Date(), "That date is in the future.")
    .optional(),
);

export const updateProfileSchema = z.object({
  name: requiredText("Name", 80),
  nickname: optionalText(40),
  pronouns: optionalText(40),
  birthday: optionalPastDate,
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
