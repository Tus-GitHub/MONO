"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";

export default function HistoryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-error-tint text-error">
        <Icon name="alertTriangle" size="lg" />
      </span>
      <h1 className="mt-4 font-display text-xl font-medium text-ink">
        Your history didn&apos;t load
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        Usually a passing hiccup — nothing is lost.
      </p>
      <div className="mt-6 flex gap-2">
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
        <LinkButton href="/dates">Open the calendar</LinkButton>
      </div>
    </div>
  );
}
