"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/utils/result";
import { selectPlaceForDateAction } from "@/server/actions/place";
import type { ButtonSize, ButtonVariant } from "@/components/ui/_shared";

export interface PlaceRef {
  savedPlaceId: string | null;
  external: { provider: string; providerPlaceId: string } | null;
  name: string;
  category: string;
  address: string | null;
  city: string | null;
}

/** Attaches a place (saved / external / custom) to the Date being planned, then returns to it. */
export function SelectPlaceButton({
  dateId,
  place,
  size = "sm",
  variant = "primary",
  label = "Choose this place",
  redirectTo,
}: {
  dateId: string;
  place: PlaceRef;
  size?: ButtonSize;
  variant?: ButtonVariant;
  label?: string;
  redirectTo?: string;
}) {
  const [, action] = useActionState(selectPlaceForDateAction, idleState);

  return (
    <form action={action}>
      <input type="hidden" name="dateId" value={dateId} />
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
      {place.savedPlaceId ? (
        <>
          <input type="hidden" name="mode" value="saved" />
          <input type="hidden" name="savedPlaceId" value={place.savedPlaceId} />
        </>
      ) : place.external ? (
        <>
          <input type="hidden" name="mode" value="external" />
          <input type="hidden" name="provider" value={place.external.provider} />
          <input type="hidden" name="providerPlaceId" value={place.external.providerPlaceId} />
        </>
      ) : (
        <>
          <input type="hidden" name="mode" value="custom" />
          <input type="hidden" name="name" value={place.name} />
          <input type="hidden" name="category" value={place.category} />
          {place.address ? <input type="hidden" name="address" value={place.address} /> : null}
          {place.city ? <input type="hidden" name="city" value={place.city} /> : null}
        </>
      )}
      <SubmitButton size={size} variant={variant} pendingText="Choosing…">
        {label}
      </SubmitButton>
    </form>
  );
}
