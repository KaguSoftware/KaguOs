import { Skeleton } from "@/components/ui/skeleton";

// Route-specific skeleton mirroring the finance layout (stat tiles, chart,
// panels) so a cold navigation shows the real shape, not generic cards.
export default function FinanceLoading() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* tabs */}
      <Skeleton className="mb-5 h-8 w-48" />

      <div className="grid gap-6">
        {/* stat tiles */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[86px] w-full" />
          ))}
        </div>

        {/* cash-flow chart */}
        <Skeleton className="h-64 w-full" />

        {/* two side panels */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>

        {/* tables */}
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
  );
}
