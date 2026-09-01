import { z } from "zod";
import { PlaceCategory } from "@prisma/client";

import { idSchema, optionalText, requiredText } from "@/lib/validation/common";

const coord = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.coerce.number().finite().optional(),
);

export const placeSearchSchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.nativeEnum(PlaceCategory).optional(),
  lat: coord,
  lng: coord,
});

export const customPlaceSchema = z.object({
  name: requiredText("Place name", 160),
  category: z.nativeEnum(PlaceCategory).default(PlaceCategory.OTHER),
  address: optionalText(240),
  city: optionalText(120),
});

/** How a place is being chosen for a Date / activity. */
export const selectPlaceSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("saved"), savedPlaceId: idSchema }),
  z.object({
    mode: z.literal("external"),
    provider: z.string().trim().min(1).max(40),
    providerPlaceId: z.string().trim().min(1).max(200),
  }),
  z.object({
    mode: z.literal("custom"),
    name: requiredText("Place name", 160),
    category: z.nativeEnum(PlaceCategory).default(PlaceCategory.OTHER),
    address: optionalText(240),
    city: optionalText(120),
  }),
]);

export type PlaceSearchInput = z.infer<typeof placeSearchSchema>;
export type CustomPlaceInput = z.infer<typeof customPlaceSchema>;
export type SelectPlaceInput = z.infer<typeof selectPlaceSchema>;
