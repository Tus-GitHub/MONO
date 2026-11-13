import { z } from "zod";

/** Preserve case; trim only the surrounding whitespace used by all name entry points. */
export const nameSchema = z.string().trim().min(1, "Name is required.").max(80, "Name is too long.");
