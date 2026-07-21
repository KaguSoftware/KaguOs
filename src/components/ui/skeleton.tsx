import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  // For boxes whose size is only known at runtime — a screenshot thumbnail
  // reserves its real aspect ratio so the image doesn't shift the row when it
  // lands. Utility classes can't express a computed ratio.
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn("animate-pulse rounded-md bg-raised", className)}
    />
  );
}
