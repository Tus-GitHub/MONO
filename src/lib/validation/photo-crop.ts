import { z } from "zod";
import { readSavedCrop } from "@/lib/images/saved-crop";
import { idSchema } from "./common";

export const cropTargetSchema = z.object({ kind: z.enum(["avatar", "couple", "date", "chat"]), id: idSchema.optional() }).strict()
  .refine((value) => ["avatar", "couple"].includes(value.kind) ? !value.id : Boolean(value.id), "Choose a saved photo.");
export const savedCropSchema = z.object({ x: z.number().finite(), y: z.number().finite(), width: z.number().finite(), height: z.number().finite() }).strict()
  .refine((value) => Boolean(readSavedCrop(value)), "Keep the crop inside the photo.");
export const saveCropSchema = z.object({ target: cropTargetSchema, revision: z.string().min(1).max(100), crop: savedCropSchema.nullable() }).strict();
export type SavedCropTarget = z.infer<typeof cropTargetSchema>;
