"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";

/** Explore leans on an external place provider — degrade to a calm, honest message. */
export default function ExploreError({
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
        <Icon name="compass" size="lg" />
      </span>
      <h1 className="mt-4 font-display text-xl font-medium text-ink">
        Explore had trouble loading
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        Recommendations and place search may be briefly unavailable. Everything you&apos;ve
        already saved is safe.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
        <LinkButton href="/dates">Our dates</LinkButton>
      </div>
    </div>
  );
}
