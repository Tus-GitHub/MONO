import { z } from "zod";

import { optionalText } from "@/lib/validation/common";
import { nameSchema } from "@/lib/validation/name";

const optionalPastDate = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.coerce
    .date()
    .max(new Date(), "That date is in the future.")
    .optional(),
);

export const updateProfileSchema = z.object({
  name: nameSchema,
  nickname: optionalText(40),
  pronouns: optionalText(40),
  birthday: optionalPastDate,
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
