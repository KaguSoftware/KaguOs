"use client";

import { useMemo, useState, type ReactNode } from "react";
import { DateRangeControl, rangeForPreset } from "@/components/ui/date-range-control";
import { EXPENSE, INCOME } from "@/components/management/finance-charts";
import {
  formatRangeLabel,
  formatTRY,
  sumRange,
  sumRecurringRange,
  type FxRates,
  type LifetimeTotals,
} from "@/lib/finance";
import { cn, type DateRange } from "@/lib/utils";
import type { RecurringItem, Transaction } from "@/lib/types";

function Tile({
  label,
  value,
  sub,
  tone,
  className,
  children,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "green" | "red";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("rounded-lg border border-line bg-surface p-4", className)}>
      <p className="text-[calc(13px*var(--text-scale,1))] text-muted">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-xl font-semibold tracking-tight",
          tone === "green" && "text-primary-dim",
          tone === "red" && "text-danger"
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-faint">{sub}</p>}
      {children && <div className="mt-1.5">{children}</div>}
    </div>
  );
}

/**
 * In and out on one scale, so the gap between them is visible as a length and
 * not only readable as two numbers. Both bars are direct-labelled with their TL
 * amount, so nothing is encoded in colour alone.
 */
function Bar({
  label,
  value,
  max,
  hue,
}: {
  label: string;
  value: number;
  /** Shared by both bars — one scale, or the lengths say nothing. */
  max: number;
  hue: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-[calc(12px*var(--text-scale,1))] text-muted">
        {label}
      </span>
      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-line/50" aria-hidden>
        <span
          className="block h-full rounded-full transition-[width] duration-200 ease-out"
          style={{
            width: max === 0 ? "0%" : `${(value / max) * 100}%`,
            background: hue,
          }}
        />
      </span>
      <span className="w-28 shrink-0 text-right font-mono text-[calc(12px*var(--text-scale,1))] text-ink">
        {formatTRY(value)}
      </span>
    </div>
  );
}

/**
 * The finance headline: what came in, what went out, what it netted, and what
 * the subscriptions billed — all for one window the reader picks.
 *
 * One set of tiles, one control. The page used to carry a fixed "this month"
 * row above a separate range panel, which meant two blocks of the same four
 * numbers that could only ever agree in one month of the year; now the interval
 * IS the question, and the month is just its default answer.
 *
 * Transaction totals come from settled rows; the recurring figure counts the
 * billing occurrences that fall inside the window (see `sumRecurringRange`), so
 * it is money the schedule says was charged in the period, not a
 * monthly-equivalent smeared across it. All-time net rides in the same row
 * because it is the one figure no interval can change — it is labelled as such
 * and never moves when the dates do.
 */
export function RangeSummary({
  transactions,
  recurring,
  lifetime,
  rates,
  today,
  oldestLoaded,
}: {
  /** Settled rows only — pending money hasn't moved, so it isn't a total yet. */
  transactions: Transaction[];
  recurring: RecurringItem[];
  /** Net across the WHOLE settled ledger — range-independent, so it is summed
   *  on the server off every row rather than off the page's capped window. */
  lifetime: LifetimeTotals;
  rates: FxRates;
  /** Istanbul's today, from the server — see the note on `DateRangeControl`. */
  today: string;
  /**
   * The oldest transaction this page actually loaded, or null when the ledger
   * came back whole. The query is capped, so a window reaching further back
   * than this would under-count and read as a quiet month — the panel says so
   * rather than printing a confident wrong number.
   */
  oldestLoaded: string | null;
}) {
  const [range, setRange] = useState<DateRange>(
    () => rangeForPreset("mtd", today) ?? { from: today, to: today }
  );

  const { totals, recurringTotals, skipped } = useMemo(() => {
    const ledger = sumRange(transactions, rates, range);
    const bills = sumRecurringRange(recurring, rates, range);
    return {
      totals: ledger.totals,
      recurringTotals: bills.totals,
      skipped: new Set([...ledger.skippedCurrencies, ...bills.skippedCurrencies]),
    };
  }, [transactions, recurring, rates, range]);

  const truncated = oldestLoaded !== null && range.from < oldestLoaded;
  const max = Math.max(totals.income, totals.expense);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <DateRangeControl today={today} onChange={setRange} />
        <span className="text-[calc(12px*var(--text-scale,1))] text-faint">
          TL equivalent, settled only
        </span>
      </div>

      <p className="text-[calc(13px*var(--text-scale,1))] text-faint">
        <span className="text-muted">{formatRangeLabel(range)}</span> ·{" "}
        {totals.count} {totals.count === 1 ? "transaction" : "transactions"}
      </p>

      {truncated && (
        <p className="rounded-md border border-amber/30 bg-amber/10 px-3 py-2 text-[calc(13px*var(--text-scale,1))] text-amber">
          This window reaches back further than the transactions loaded on this page,
          so the totals are incomplete — narrow the range for a figure you can stand
          behind.
        </p>
      )}

      {skipped.size > 0 && (
        <p className="rounded-md border border-amber/30 bg-amber/10 px-3 py-2 text-[calc(13px*var(--text-scale,1))] text-amber">
          Some {[...skipped].join(" and ")} amounts in this window are excluded from
          the totals — set the missing rate to include them.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tile
          label="Total net, all time"
          value={formatTRY(lifetime.net)}
          tone={lifetime.net >= 0 ? "green" : "red"}
          sub={
            lifetime.count === 0
              ? "No settled transactions yet"
              : `${formatTRY(lifetime.income)} in · ${formatTRY(lifetime.expense)} out${
                  lifetime.complete
                    ? ` · ${lifetime.count} settled`
                    : " · partial, ledger past the read cap"
                }`
          }
          className="sm:col-span-2 lg:col-span-1"
        />
        <Tile label="In" value={formatTRY(totals.income)} tone="green" />
        <Tile label="Out" value={formatTRY(totals.expense)} tone="red" />
        <Tile
          label="Net"
          value={formatTRY(totals.net)}
          tone={totals.net >= 0 ? "green" : "red"}
          sub={
            totals.count === 0
              ? "Nothing recorded in this range"
              : `${formatTRY(totals.income)} in · ${formatTRY(totals.expense)} out`
          }
        />
        <Tile
          label="Recurring billed"
          value={formatTRY(recurringTotals.net)}
          tone={recurringTotals.net >= 0 ? "green" : "red"}
          sub={
            recurringTotals.count === 0
              ? "No recurring charges in this range"
              : `${formatTRY(recurringTotals.income)} in · ${formatTRY(recurringTotals.expense)} out · ${recurringTotals.count} ${
                  recurringTotals.count === 1 ? "charge" : "charges"
                } across ${recurringTotals.items} ${
                  recurringTotals.items === 1 ? "item" : "items"
                }`
          }
        />
      </div>

      <div className="grid gap-2 rounded-lg border border-line bg-surface p-4">
        <Bar label="In" value={totals.income} max={max} hue={INCOME} />
        <Bar label="Out" value={totals.expense} max={max} hue={EXPENSE} />
      </div>
    </div>
  );
}
