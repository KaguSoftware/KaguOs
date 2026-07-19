import { Skeleton } from "@/components/ui/skeleton";

/**
 * Streams instantly on navigation so sections never feel like they hang.
 *
 * Deliberately GENERIC. This file sits at the (app) segment, so it is both the
 * dashboard's skeleton AND the fallback for every route below that doesn't
 * ship its own loading.tsx (debug and finance do). Shaping it to the dashboard
 * would make every other section flash the wrong silhouette, so it stays a
 * neutral header-plus-blocks: header, a banner, then content.
 */
export default function Loading() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
