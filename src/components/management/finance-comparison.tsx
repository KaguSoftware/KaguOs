"use client";

import { useMemo, useState, type ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { DateRangeControl, rangeForPreset } from "@/components/ui/date-range-control";
import { EXPENSE, INCOME } from "@/components/management/finance-charts";
import {
  formatRangeLabel,
  formatTRY,
  percentChange,
  sameRangeLastYear,
  sumRange,
  type FxRates,
  type RangeTotals,
} from "@/lib/finance";
import { cn, type DateRange } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

// The bars compare one period against the same period a year earlier, which is
// the "one series is the point, the rest is context" case — so this is EMPHASIS,
// not a two-colour categorical scheme: this period wears the money hue the rest
// of the finance charts use, last year wears the de-emphasis grey already used
// for chrome. Every bar is direct-labelled with its TL amount, so nothing is
// encoded in colour alone and the pair stays readable under any colour vision.
const LAST_YEAR = "var(--line-strong)";

function Delta({
  current,
  prior,
  upIsGood,
}: {
  current: number;
  prior: number;
  /** Income going up is good news; spending going up is not. */
  upIsGood: boolean;
}) {
  const pct = percentChange(current, prior);
  if (pct === null) {
    return (
      <span className="text-[calc(12px*var(--text-scale,1))] text-faint">
        nothing recorded last year
      </span>
    );
  }

  const up = pct > 0;
  // Rounding makes a 0.2% drift print as "0.0%", which reads as a bug.
  const flat = Math.abs(pct) < 0.05;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[calc(12px*var(--text-scale,1))]",
        flat ? "text-faint" : up === upIsGood ? "text-primary-dim" : "text-danger"
      )}
    >
      {!flat && <Icon className="size-3.5" aria-hidden />}
      {/* Signed, always — a bare "12%" leaves the reader guessing the direction. */}
      {flat ? "level" : `${up ? "+" : "−"}${Math.abs(pct).toFixed(1)}%`}
      <span className="text-faint">vs last year</span>
    </span>
  );
}

function Tile({
  label,
  value,
  sub,
  tone,
  children,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "green" | "red";
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
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

function CompareRow({
  label,
  now,
  then,
  max,
  hue,
}: {
  label: string;
  now: number;
  then: number;
  /** Shared across every row, so the bars are all measured on one scale. */
  max: number;
  hue: string;
}) {
  const bars = [
    { key: "now", caption: "This period", value: now, fill: hue },
    { key: "then", caption: "Last year", value: then, fill: LAST_YEAR },
  ];
  return (
    <div className="grid grid-cols-[5rem_1fr] items-center gap-x-3">
      <p className="text-[calc(13px*var(--text-scale,1))] text-muted">{label}</p>
      <div className="space-y-1">
        {bars.map((bar) => (
          <div key={bar.key} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-[calc(11px*var(--text-scale,1))] text-faint">
              {bar.caption}
            </span>
            <span
              className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-line/50"
              aria-hidden
            >
              <span
                className="block h-full rounded-full transition-[width] duration-200 ease-out"
                style={{
                  width: max === 0 ? "0%" : `${(bar.value / max) * 100}%`,
                  background: bar.fill,
                }}
              />
            </span>
            <span className="w-28 shrink-0 text-right font-mono text-[calc(12px*var(--text-scale,1))] text-ink">
              {formatTRY(bar.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Net is signed, so it gets figures rather than a bar — a length cannot be negative. */
function NetRow({ current, prior }: { current: RangeTotals; prior: RangeTotals }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <p className="text-[calc(13px*var(--text-scale,1))] text-muted">Net</p>
      <p className="flex items-baseline gap-3">
        <span
          className={cn(
            "font-mono text-[calc(15px*var(--text-scale,1))] font-semibold",
            current.net >= 0 ? "text-primary-dim" : "text-danger"
          )}
        >
          {formatTRY(current.net)}
        </span>
        <span className="text-[calc(12px*var(--text-scale,1))] text-faint">
          last year {formatTRY(prior.net)}
        </span>
      </p>
    </div>
  );
}

/**
 * "What have we spent this month, and what had we spent by this point last year?"
 *
 * Both windows are the same SHAPE — 1–26 Aug against 1–26 Aug — so a month that
 * is two thirds over is never measured against a whole one, which is the only
 * way the number answers the question people actually ask. See
 * `sameRangeLastYear` for the year-boundary details.
 */
export function SpendingComparison({
  transactions,
  rates,
  today,
  oldestLoaded,
}: {
  /** Settled rows only — pending money hasn't moved, so it can't be compared. */
  transactions: Transaction[];
  rates: FxRates;
  /** Istanbul's today, from the server — see the note on `DateRangeControl`. */
  today: string;
  /**
   * The oldest transaction this page actually loaded, or null when the ledger
   * came back whole. The query is capped, so a comparison window reaching
   * further back than this would under-count last year and read as a spending
   * collapse — the panel says so rather than printing a confident wrong number.
   */
  oldestLoaded: string | null;
}) {
  const [range, setRange] = useState<DateRange>(
    () => rangeForPreset("mtd", today) ?? { from: today, to: today }
  );

  const { current, prior, priorRange, skipped } = useMemo(() => {
    const lastYear = sameRangeLastYear(range);
    const now = sumRange(transactions, rates, range);
    const then = sumRange(transactions, rates, lastYear);
    return {
      current: now.totals,
      prior: then.totals,
      priorRange: lastYear,
      skipped: new Set([...now.skippedCurrencies, ...then.skippedCurrencies]),
    };
  }, [transactions, rates, range]);

  const truncated = oldestLoaded !== null && priorRange.from < oldestLoaded;
  const max = Math.max(current.expense, prior.expense, current.income, prior.income);
  // Three-way, not a boolean: two empty windows are "the same", not "less", and
  // an empty ledger should not congratulate anyone on cutting spending.
  const diff = current.expense - prior.expense;

  return (
    <div className="grid gap-4 p-4">
      <DateRangeControl today={today} onChange={setRange} />

      <p className="text-[calc(13px*var(--text-scale,1))] text-faint">
        <span className="text-muted">{formatRangeLabel(range)}</span> compared with{" "}
        <span className="text-muted">{formatRangeLabel(priorRange)}</span> ·{" "}
        {current.count} vs {prior.count} transactions
      </p>

      {truncated && (
        <p className="rounded-md border border-amber/30 bg-amber/10 px-3 py-2 text-[calc(13px*var(--text-scale,1))] text-amber">
          Last year&rsquo;s window reaches back further than the transactions loaded on
          this page, so the comparison is incomplete — narrow the range to compare
          like for like.
        </p>
      )}

      {skipped.size > 0 && (
        <p className="rounded-md border border-amber/30 bg-amber/10 px-3 py-2 text-[calc(13px*var(--text-scale,1))] text-amber">
          Some {[...skipped].join(" and ")} amounts in these windows are excluded from
          the totals — set the missing rate to include them.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Spent in range" value={formatTRY(current.expense)} tone="red">
          <Delta current={current.expense} prior={prior.expense} upIsGood={false} />
        </Tile>
        <Tile
          label="Same range last year"
          value={formatTRY(prior.expense)}
          sub={formatRangeLabel(priorRange)}
        />
        <Tile
          label="Difference"
          value={`${diff > 0 ? "+" : diff < 0 ? "−" : ""}${formatTRY(Math.abs(diff))}`}
          tone={diff > 0 ? "red" : diff < 0 ? "green" : undefined}
          sub={
            diff > 0
              ? "more than last year"
              : diff < 0
                ? "less than last year"
                : "same as last year"
          }
        />
      </div>

      <div className="grid gap-3 rounded-lg border border-line bg-surface p-4">
        <CompareRow
          label="Spending"
          now={current.expense}
          then={prior.expense}
          max={max}
          hue={EXPENSE}
        />
        <CompareRow
          label="Income"
          now={current.income}
          then={prior.income}
          max={max}
          hue={INCOME}
        />
        <div className="border-t border-line pt-3">
          <NetRow current={current} prior={prior} />
        </div>
      </div>
    </div>
  );
}
