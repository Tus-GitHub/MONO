import { PlaceCategory } from "@prisma/client";

import type { IconName } from "@/components/ui/icon";

export const PLACE_CATEGORY_LABEL: Record<PlaceCategory, string> = {
  RESTAURANT: "Restaurant",
  CAFE: "Café",
  BAR: "Bar",
  PARK: "Outdoors",
  CINEMA: "Cinema",
  MUSEUM: "Museum",
  ACTIVITY: "Activity",
  SHOPPING: "Shopping",
  TRAVEL: "Travel",
  HOME: "At home",
  OTHER: "Somewhere",
};

/** A warm, relationship-flavoured phrase for "your kind of date". */
export const PLACE_CATEGORY_VIBE: Record<PlaceCategory, string> = {
  RESTAURANT: "Dinner people",
  CAFE: "Coffee people",
  BAR: "Night-out people",
  PARK: "Outdoor people",
  CINEMA: "Cinema people",
  MUSEUM: "Culture people",
  ACTIVITY: "Hands-on people",
  SHOPPING: "Treasure hunters",
  TRAVEL: "Wander people",
  HOME: "Stay-in people",
  OTHER: "Your own kind",
};

export const PLACE_CATEGORY_ICON: Record<PlaceCategory, IconName> = {
  RESTAURANT: "mapPin",
  CAFE: "mapPin",
  BAR: "mapPin",
  PARK: "compass",
  CINEMA: "images",
  MUSEUM: "images",
  ACTIVITY: "sparkles",
  SHOPPING: "mapPin",
  TRAVEL: "compass",
  HOME: "home",
  OTHER: "mapPin",
};
