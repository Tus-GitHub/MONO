"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** Quietly refreshes the route so the connect step advances the moment the partner accepts. */
export function WaitingPoll({ intervalMs = 7000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3.5 py-3 text-sm text-muted">
      <Spinner size="sm" />
      <span className="flex-1">Waiting for your partner to accept…</span>
      <Button
        size="sm"
        variant="ghost"
        loading={checking}
        onClick={() => {
          setChecking(true);
          router.refresh();
          setTimeout(() => setChecking(false), 1200);
        }}
      >
        Check now
      </Button>
    </div>
  );
}
