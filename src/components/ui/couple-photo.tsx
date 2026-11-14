import { Photo } from "@/components/ui/photo";
import { COUPLE_PHOTO_ASPECT } from "@/lib/images/crop";
import { cn } from "@/lib/utils/cn";

/** The saved crop stays intact everywhere, including older photos with another aspect. */
export function CouplePhoto({ src, className, priority = false }: { src: string; className?: string; priority?: boolean }) {
  return <div className={cn("overflow-hidden", className)} style={{ aspectRatio: COUPLE_PHOTO_ASPECT }}>
    <Photo displayUrl={src} thumbUrl={src} alt="Couple photo" aspect={String(COUPLE_PHOTO_ASPECT)}
      fit="contain" className="size-full" priority={priority} sizes="(min-width: 768px) 44rem, 100vw" />
  </div>;
}
