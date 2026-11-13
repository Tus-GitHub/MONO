"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TaskScope, type TaskState } from "@/lib/state/task";

/** Immediate single-flight ownership, abort on teardown, and no stale completion updates. */
export function useAsyncTask<T, Phase extends string = string>() {
  const scope = useRef(new TaskScope());
  const [state, setState] = useState<TaskState<T, Phase>>({ status: "idle" });
  useEffect(() => {
    const owner = scope.current;
    return () => owner.cancel();
  }, []);

  const run = useCallback(async <R extends T>(phase: Phase, work: (signal: AbortSignal) => Promise<R>) => {
    const signal = scope.current.begin();
    if (!signal) return undefined;
    setState({ status: "pending", phase });
    try {
      const data = await work(signal);
      if (!scope.current.finish(signal)) return undefined;
      setState({ status: "success", data });
      return { data };
    } catch (error) {
      if (!scope.current.finish(signal)) return undefined;
      setState({ status: "error", phase, message: error instanceof Error ? error.message : "The request failed. Try again." });
      return undefined;
    }
  }, []);

  const reset = useCallback(() => {
    scope.current.cancel();
    setState({ status: "idle" });
  }, []);
  return { state, run, reset };
}
