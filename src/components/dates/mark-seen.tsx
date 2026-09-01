"use client";

import { useEffect, useRef } from "react";

import { markDatesSeenAction } from "@/server/actions/date";

/** Fire-and-forget: records that this member has looked at the couple's date activity. */
export function MarkDatesSeen() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void markDatesSeenAction();
  }, []);
  return null;
}
