"use client";

import { useCallback, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

interface PhotoProps {
  thumbUrl: string;
  displayUrl: string;
  blurDataUrl?: string | null;
  width?: number | null;
  height?: number | null;
  alt: string;
  /** `srcset` sizing hint. */
  sizes?: string;
  /** CSS aspect-ratio override, e.g. "3 / 2". Defaults to the image's own, then 3 / 2. */
  aspect?: string;
  /** Load eagerly (above the fold). */
  priority?: boolean;
  className?: string;
  imgClassName?: string;
}

/**
 * The private-photo primitive: an aspect-ratio box (no layout shift), a blur-up placeholder,
 * lazy loading, and a `srcset` that lets the browser pick the smallest variant that fits.
 * No `next/image` — these sources are behind per-request authorization.
 */
export function Photo({
  thumbUrl,
  displayUrl,
  blurDataUrl,
  width,
  height,
  alt,
  sizes = "(min-width: 640px) 33vw, 100vw",
  aspect,
  priority = false,
  className,
  imgClassName,
}: PhotoProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  const ref = useCallback((node: HTMLImageElement | null) => {
    if (node && node.complete && node.naturalWidth > 0) setStatus("loaded");
  }, []);

  const ratio = aspect ?? (width && height ? `${width} / ${height}` : "3 / 2");

  return (
    <div
      className={cn("relative overflow-hidden bg-line", className)}
      style={{ aspectRatio: ratio }}
    >
      {blurDataUrl ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 scale-110 bg-cover bg-center blur-xl"
          style={{ backgroundImage: `url("${blurDataUrl}")` }}
        />
      ) : (
        <div aria-hidden="true" className="skeleton absolute inset-0 rounded-none" />
      )}

      {status === "error" ? (
        <div className="absolute inset-0 grid place-items-center text-faint">
          <Icon name="images" size={28} />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- private /media source, not a next/image origin
        <img
          ref={ref}
          src={displayUrl}
          srcSet={`${thumbUrl} 480w, ${displayUrl} 1400w`}
          sizes={sizes}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          // fetchPriority is valid DOM; React lowercases it for the attribute.
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-slow ease-out",
            status === "loaded" ? "opacity-100" : "opacity-0",
            imgClassName,
          )}
        />
      )}
    </div>
  );
}
