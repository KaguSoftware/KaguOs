import { Skeleton } from "@/components/ui/skeleton";

// Route-specific skeleton mirroring the debug board (focus banner, board tab
// strip, preset + filter row, task list) so a cold navigation shows the real
// shape instead of a spinner in the middle of nothing.
export default function DebugLoading() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* focus banner */}
      <Skeleton className="mb-4 h-12 w-full" />

      {/* project board tabs */}
      <Skeleton className="mb-3 h-9 w-80" />

      {/* presets + live status */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-7 w-40" />
      </div>

      {/* search + filter controls */}
      <div className="mb-3 flex flex-wrap gap-2">
        <Skeleton className="h-9 flex-1 min-w-44" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-36" />
        ))}
      </div>

      {/* the task rows — the thing you actually came for */}
      <div className="space-y-px overflow-hidden rounded-lg border border-line">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[62px] w-full rounded-none" />
        ))}
      </div>
    </div>
  );
}
