"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { BreakdownItem } from "@/components/management/finance-charts";
import type { MonthPoint } from "@/lib/finance";

// recharts is ~100 KB gzipped — about as much as the rest of a page's JS. The
// charts load after the page is interactive instead of blocking it; they sit in
// panels (often a hidden tab) where a beat of skeleton costs nothing. Server
// components can't call dynamic() with ssr:false, so they import from here.

const Cashflow = dynamic(
  () => import("@/components/management/finance-charts").then((m) => m.CashflowChart),
  {
    ssr: false,
    // Legend row + the h-64 plot, so the panel doesn't jump when it lands.
    loading: () => (
      <div className="px-4 pb-2 pt-3">
        <Skeleton className="h-[calc(18px+16rem)]" />
      </div>
    ),
  },
);

const Breakdown = dynamic(
  () => import("@/components/management/finance-charts").then((m) => m.RecurringBreakdown),
  { ssr: false, loading: () => null },
);

export function CashflowChart({ data }: { data: MonthPoint[] }) {
  return <Cashflow data={data} />;
}

export function RecurringBreakdown(props: { items: BreakdownItem[]; hiddenCount?: number }) {
  // The chart's height follows its row count (see finance-charts), so the
  // reservation has to be computed here — a dynamic() loader never sees props.
  // +41px is the totals footer.
  const height = Math.max(120, props.items.length * 34 + 24) + 41;
  return (
    <div style={{ minHeight: height }}>
      <Breakdown {...props} />
    </div>
  );
}
