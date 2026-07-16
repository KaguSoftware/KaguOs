// Finance math — TRY is the base currency; USD/EUR convert through manually
// entered rates (stored until changed). Anything without a rate is excluded
// from TRY totals and surfaced as a warning, never silently dropped.

import type { Currency, RecurringItem, Transaction } from "@/lib/types";

export type FxRates = Partial<Record<"USD" | "EUR", number>>;

export function toTRY(
  amount: number,
  currency: Currency,
  rates: FxRates
): number | null {
  if (currency === "TRY") return amount;
  const rate = rates[currency];
  return rate ? amount * rate : null;
}

/** Monthly-equivalent cost/income of a recurring item. */
export function monthlyAmount(item: RecurringItem): number {
  return item.cadence === "monthly" ? item.amount : item.amount / 12;
}

export function isActiveRecurring(item: RecurringItem): boolean {
  return item.canceled_on === null;
}

export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** The last n months, oldest first: [{ key: "2026-07", label: "Jul" }, …]. */
export function lastMonths(n: number): { key: string; label: string }[] {
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label =
      d.getMonth() === 0 || i === n - 1
        ? `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
        : MONTH_LABELS[d.getMonth()];
    out.push({ key, label });
  }
  return out;
}

export type MonthPoint = {
  key: string;
  label: string;
  income: number;
  expense: number;
};

/** 12-month income/expense series in TRY (rows without a rate are counted separately). */
export function buildCashflowSeries(
  transactions: Transaction[],
  rates: FxRates,
  months = 12
): { series: MonthPoint[]; skippedCurrencies: Set<string> } {
  const skipped = new Set<string>();
  const byMonth = new Map<string, { income: number; expense: number }>();
  const frame = lastMonths(months);
  for (const m of frame) byMonth.set(m.key, { income: 0, expense: 0 });

  for (const t of transactions) {
    const bucket = byMonth.get(monthKey(t.occurred_on));
    if (!bucket) continue;
    const converted = toTRY(Number(t.amount), t.currency, rates);
    if (converted === null) {
      skipped.add(t.currency);
      continue;
    }
    bucket[t.type] += converted;
  }

  return {
    series: frame.map((m) => ({
      ...m,
      income: Math.round(byMonth.get(m.key)!.income),
      expense: Math.round(byMonth.get(m.key)!.expense),
    })),
    skippedCurrencies: skipped,
  };
}

export function formatTRY(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(amount);
}
