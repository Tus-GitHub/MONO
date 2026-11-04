"use client";

import { z } from "zod";
import { useDraftState } from "@/lib/hooks/use-draft-state";

const textSchema = z.string();

export function useLocalDraft(key: string, serverValue: string) {
  return useDraftState(key, serverValue, textSchema);
}
