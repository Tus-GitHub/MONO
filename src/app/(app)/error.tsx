"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";

/**
 * Route-group error boundary — renders inside the app shell, so the nav stays put. Anything a
 * page throws that doesn't have a closer `error.tsx` lands here.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const offline = !useOnlineStatus();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-error-tint text-error">
        <Icon name="alertTriangle" size="lg" />
      </span>
      <h1 className="mt-4 font-display text-xl font-medium text-ink">
        {offline ? "You appear to be offline" : "This didn't load"}
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        {offline
          ? "Reconnect and try again — nothing you'd already saved is lost."
          : "A hiccup on our side. Trying again usually clears it."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
        <LinkButton href="/home">Go home</LinkButton>
      </div>
      {error.digest ? (
        <p className="mt-6 text-2xs text-faint">Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
