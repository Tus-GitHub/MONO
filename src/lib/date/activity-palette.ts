import type { IconName } from "@/components/ui/icon";

/** Quick-add activity presets. `custom` is handled separately by a free-text field. */
export interface ActivityPreset {
  key: string;
  title: string;
  icon: IconName;
  durationMinutes: number;
}

export const ACTIVITY_PRESETS: ActivityPreset[] = [
  { key: "coffee", title: "Coffee", icon: "mapPin", durationMinutes: 45 },
  { key: "dinner", title: "Dinner", icon: "mapPin", durationMinutes: 90 },
  { key: "dessert", title: "Dessert", icon: "sparkles", durationMinutes: 45 },
  { key: "movie", title: "Movie", icon: "images", durationMinutes: 130 },
  { key: "walk", title: "Walk", icon: "compass", durationMinutes: 60 },
  { key: "museum", title: "Museum", icon: "images", durationMinutes: 90 },
  { key: "adventure", title: "Adventure", icon: "compass", durationMinutes: 120 },
  { key: "shopping", title: "Shopping", icon: "mapPin", durationMinutes: 60 },
  { key: "games", title: "Games", icon: "sparkles", durationMinutes: 75 },
  { key: "photography", title: "Photography", icon: "camera", durationMinutes: 60 },
];
