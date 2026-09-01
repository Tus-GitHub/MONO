import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type Aspect = "square" | "4/3" | "3/2" | "16/9" | "portrait";

const ASPECT: Record<Aspect, string> = {
  square: "aspect-square",
  "4/3": "aspect-[4/3]",
  "3/2": "aspect-[3/2]",
  "16/9": "aspect-video",
  portrait: "aspect-[3/4]",
};

interface ImageCardProps {
  src: string;
  alt: string;
  aspect?: Aspect;
  caption?: ReactNode;
  /** Content pinned to the bottom over a gradient scrim. */
  overlay?: ReactNode;
  /** Content pinned to the top-right (badges, menu). */
  topRight?: ReactNode;
  href?: string;
  priority?: boolean;
  sizes?: string;
  rounded?: "lg" | "xl";
  /** Skip the image optimizer (e.g. for data: URIs or already-sized assets). */
  unoptimized?: boolean;
  className?: string;
}

/**
 * Photography-first surface. The image is always cropped with `object-cover`; text sits over
 * a scrim so it stays legible on any photo.
 */
export function ImageCard({
  src,
  alt,
  aspect = "4/3",
  caption,
  overlay,
  topRight,
  href,
  priority,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  rounded = "lg",
  unoptimized,
  className,
}: ImageCardProps) {
  const body = (
    <div
      className={cn(
        "group relative isolate overflow-hidden bg-line",
        rounded === "xl" ? "rounded-xl" : "rounded-lg",
        ASPECT[aspect],
        className,
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized={unoptimized}
        className="object-cover transition-transform duration-slow ease-out group-hover:scale-[1.03]"
      />

      {topRight ? <div className="absolute right-2 top-2 z-10 flex gap-1.5">{topRight}</div> : null}

      {overlay || caption ? (
        <div className="absolute inset-x-0 bottom-0 z-10 bg-linear-to-t from-black/65 via-black/20 to-transparent p-3 pt-10">
          {overlay}
          {caption ? (
            <p className="line-clamp-2 text-sm font-medium text-white drop-shadow-sm">{caption}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (!href) return body;

  return (
    <Link
      href={href}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
    >
      {body}
    </Link>
  );
}
