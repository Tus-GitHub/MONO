import { cn } from "@/lib/utils/cn";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE: Record<AvatarSize, string> = {
  xs: "size-6 text-[0.625rem]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-16 text-xl",
};

const TINTS = [
  "bg-primary-tint text-primary",
  "bg-accent-tint text-accent",
  "bg-success-tint text-success",
  "bg-warning-tint text-warning",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return TINTS[Math.abs(hash) % TINTS.length];
}

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  ring?: boolean;
  className?: string;
}

export function Avatar({ name, src, size = "md", ring, className }: AvatarProps) {
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-medium uppercase",
        SIZE[size],
        !src && tintFor(name),
        ring && "ring-2 ring-surface",
        className,
      )}
      aria-hidden="true"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" loading="lazy" decoding="async" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
