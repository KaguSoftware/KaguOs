import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the testing board: header, project tabs, progress bar, filter row,
// then the checklist.
export default function TestingLoading() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="mb-4 h-9 w-80" />
      <Skeleton className="mb-4 h-14 w-full" />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-9 min-w-36 flex-1" />
      </div>
      <div className="space-y-px overflow-hidden rounded-lg border border-line">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[52px] w-full rounded-none" />
        ))}
      </div>
    </div>
  );
}
