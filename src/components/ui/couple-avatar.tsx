import { Avatar, type AvatarProps, type AvatarSize } from "@/components/ui/avatar";
import { cn } from "@/lib/utils/cn";

interface Member {
  name: string;
  src?: string | null;
}

interface CoupleAvatarProps {
  members: Member[];
  size?: AvatarSize;
  className?: string;
}

const OVERLAP: Partial<Record<AvatarSize, string>> = {
  xs: "-ml-2",
  sm: "-ml-2.5",
  md: "-ml-3",
  lg: "-ml-4",
  xl: "-ml-5",
};

const PLACEHOLDER_SIZE: Record<AvatarSize, string> = {
  xs: "size-6",
  sm: "size-8",
  md: "size-10",
  lg: "size-12",
  xl: "size-16",
};

/** Two overlapping avatars — the "two as one" motif. Shows a dashed placeholder for a partner who hasn't joined. */
export function CoupleAvatar({ members, size = "md", className }: CoupleAvatarProps) {
  const [first, second] = members;
  return (
    <span className={cn("inline-flex items-center", className)}>
      {first ? <Avatar name={first.name} src={first.src} size={size} ring /> : null}
      {second ? (
        <Avatar
          name={second.name}
          src={second.src}
          size={size}
          ring
          className={OVERLAP[size]}
        />
      ) : (
        <span
          className={cn(
            "grid place-items-center rounded-full border border-dashed border-line-strong bg-surface text-faint ring-2 ring-surface",
            PLACEHOLDER_SIZE[size],
            OVERLAP[size],
          )}
          aria-hidden="true"
        >
          <span className="text-xs">+</span>
        </span>
      )}
    </span>
  );
}

export type { AvatarProps };
