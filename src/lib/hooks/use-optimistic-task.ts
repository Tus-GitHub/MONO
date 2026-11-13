"use client";

import { useState } from "react";
import { useAsyncTask } from "@/lib/hooks/use-async-task";

/** Roll back to the last displayed value, and serialize repeated clicks before React renders. */
export function useOptimisticTask<T>(initial: T) {
  const [local, setLocal] = useState({ base: initial, value: initial });
  const task = useAsyncTask<T, "saving">();
  if (!Object.is(local.base, initial)) setLocal({ base: initial, value: initial });
  const value = Object.is(local.base, initial) ? local.value : initial;
  const run = async (next: T, mutation: () => Promise<T>) => {
    const previous = value;
    return task.run("saving", async (signal) => {
      setLocal({ base: initial, value: next });
      try {
        const saved = await mutation();
        if (!signal.aborted) setLocal({ base: initial, value: saved });
        return saved;
      } catch (error) {
        if (!signal.aborted) setLocal({ base: initial, value: previous });
        throw error;
      }
    });
  };
  return { value, run, pending: task.state.status === "pending", state: task.state };
}
