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

/**
 * PageHeader's silhouette at its REAL height — display title, accent rule,
 * description. A 28px title block here made every page jump ~20px when the
 * 34/48px header streamed in over it.
 */
export function PageHeaderSkeleton({ width = "w-56" }: { width?: string }) {
  return (
    <div className="mb-8">
      <Skeleton className={cn("h-9 md:h-[52px]", width)} />
      <Skeleton className="mt-3 h-[3px] w-12 rounded-full" />
      <Skeleton className="mt-3 h-4 w-64" />
    </div>
  );
}
