"use client";

import { useCallback, useState } from "react";
import { Icon } from "@/components/ui/icon";

export function PlaceImage({ src, name }: { src: string; name: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  // An SSR image can fail before React attaches its error handler during hydration.
  const checkImage = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth === 0) setFailedUrl(src);
  }, [src]);
  if (failedUrl === src) return (
    <div className="grid size-full place-items-center bg-linear-to-br from-primary-tint via-surface to-accent-tint">
      <Icon name="mapPin" size={32} className="text-primary/60" />
    </div>
  );
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={checkImage} src={src} alt={name} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="size-full object-cover" onError={() => setFailedUrl(src)} />;
}
