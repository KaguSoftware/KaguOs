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

      {/* THE toolbar: presets · search · Filters · ⋯ · live. One row, like
          the real chrome — the skeleton promising two rows of controls would
          make the loaded page appear to jump. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-9 min-w-36 flex-1" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-10" />
        <Skeleton className="h-4 w-20" />
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
