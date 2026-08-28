// Finance math — TRY is the base currency; USD/EUR convert through manually
// entered rates (stored until changed). Anything without a rate is excluded
// from TRY totals and surfaced as a warning, never silently dropped.

import { formatDate, todayInIstanbul, type DateRange } from "@/lib/utils";
import type { Currency, RecurringItem, Transaction } from "@/lib/types";

/**
 * How many transactions the management page loads in one go.
 *
 * Shared rather than inlined at the query, because the year-on-year panel has
 * to know whether the ledger it was handed is the whole thing or a truncated
 * window — a comparison against a year that got cut off reads as a spending
 * collapse, and the two numbers must not be able to drift apart.
 */
export const TRANSACTION_PAGE = 500;

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

// ---------------------------------------------------------------------------
// Billing schedule — "when does this one hit?"
// ---------------------------------------------------------------------------

/**
 * The day of the month an item bills on.
 *
 * `billing_day` when it was entered, otherwise the day it started — the
 * assumption every row written before the column existed was already making,
 * now stated in one place instead of guessed at each call site.
 */
export function billingDay(item: RecurringItem): number {
  return item.billing_day ?? Number(item.started_on.slice(8, 10));
}

/**
 * `YYYY-MM-DD` for a given day in a given month, clamped to that month's last
 * day — so "the 31st" lands on 28 Feb rather than rolling into March.
 *
 * Month is 1-based. Day 0 of the next month is the last day of this one.
 */
function onDayOf(year: number, month: number, day: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  const dd = String(Math.min(day, lastDay)).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * The next date this item bills, as `YYYY-MM-DD`, or null if it's canceled.
 *
 * Two rules do all the work:
 *
 *   - never before the item started, so a subscription entered with a future
 *     start date reads "first bill 1 Sep", not a date in the past;
 *   - each occurrence is computed from the billing DAY, never by stepping the
 *     previous occurrence. Stepping drifts: 31 Jan clamped to 28 Feb, stepped
 *     again, gives 28 Mar, and a card billed on the 31st never sees the 31st
 *     again. Recomputing from the anchor keeps 31 Jan → 28 Feb → 31 Mar.
 *
 * A yearly item bills in `started_on`'s month; a monthly one in every month.
 */
export function nextBillingOn(
  item: RecurringItem,
  today: string = todayInIstanbul()
): string | null {
  if (!isActiveRecurring(item)) return null;

  const day = billingDay(item);
  // Plain string compare — both are YYYY-MM-DD (see DateRange in lib/utils).
  const from = today > item.started_on ? today : item.started_on;
  const [year, month] = from.split("-").map(Number);

  if (item.cadence === "yearly") {
    const billingMonth = Number(item.started_on.slice(5, 7));
    const thisYear = onDayOf(year, billingMonth, day);
    return thisYear >= from ? thisYear : onDayOf(year + 1, billingMonth, day);
  }

  const thisMonth = onDayOf(year, month, day);
  if (thisMonth >= from) return thisMonth;
  return month === 12 ? onDayOf(year + 1, 1, day) : onDayOf(year, month + 1, day);
}

/** "1st", "2nd", "23rd" — for reading a billing day back as a phrase. */
export function ordinalDay(day: number): string {
  // 11th/12th/13th are the exceptions the naive rule gets wrong.
  const suffix =
    day % 100 >= 11 && day % 100 <= 13
      ? "th"
      : ["th", "st", "nd", "rd"][day % 10] ?? "th";
  return `${day}${suffix}`;
}

/** "monthly on the 14th" / "yearly on 14 Mar" — the cadence, said in full. */
export function billingScheduleLabel(item: RecurringItem): string {
  if (item.cadence === "yearly") {
    // A yearly charge has one date a year, so name it: the day alone ("the
    // 14th") would leave the reader hunting for the month in `started_on`.
    const month = MONTH_LABELS[Number(item.started_on.slice(5, 7)) - 1];
    return `yearly on ${billingDay(item)} ${month}`;
  }
  return `monthly on the ${ordinalDay(billingDay(item))}`;
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

// ---------------------------------------------------------------------------
// Custom ranges — totals for a window of the reader's choosing
// ---------------------------------------------------------------------------

export type RangeTotals = {
  income: number;
  expense: number;
  /** income − expense */
  net: number;
  /** How many transactions landed in the window — the tiles say so, because a
   *  drop to zero spend usually means "nothing recorded yet", not "spent nothing". */
  count: number;
};

/** Income/expense in TL for one inclusive window. Rows without a rate are excluded and reported. */
export function sumRange(
  transactions: Transaction[],
  rates: FxRates,
  range: DateRange
): { totals: RangeTotals; skippedCurrencies: Set<string> } {
  const skipped = new Set<string>();
  let income = 0;
  let expense = 0;
  let count = 0;

  for (const t of transactions) {
    // Plain string compare — see the DateRange doc comment.
    if (t.occurred_on < range.from || t.occurred_on > range.to) continue;
    const converted = toTRY(Number(t.amount), t.currency, rates);
    if (converted === null) {
      skipped.add(t.currency);
      continue;
    }
    count++;
    if (t.type === "income") income += converted;
    else expense += converted;
  }

  return {
    totals: {
      income: Math.round(income),
      expense: Math.round(expense),
      net: Math.round(income - expense),
      count,
    },
    skippedCurrencies: skipped,
  };
}

/** "1 – 26 Aug 2026" — one range, read as a phrase. */
export function formatRangeLabel(range: DateRange): string {
  return `${formatDate(range.from)} – ${formatDate(range.to)}`;
}

// ---------------------------------------------------------------------------
// All time — "what has this company netted, ever"
// ---------------------------------------------------------------------------

/**
 * Rows per page when reading the WHOLE settled ledger.
 *
 * Matches PostgREST's `max_rows` (supabase/config.toml). It has to: a page
 * asked for in 2000s would come back silently clipped to 1000, the caller
 * would see a short page, call it the end of the ledger, and the all-time net
 * would quietly under-count by everything older. Asking for exactly the server
 * cap makes "short page" mean "no more rows" again.
 */
export const LEDGER_PAGE = 1000;

/**
 * How many pages the all-time read will walk before giving up (20k settled
 * rows). A ceiling, not a target — it exists so a runaway ledger can never turn
 * one page render into an unbounded chain of round-trips. Hitting it is
 * reported, never hidden: see `complete` on LifetimeTotals.
 */
export const LEDGER_MAX_PAGES = 20;

/** The only three columns the all-time sum needs — the rest is payload weight. */
export type LedgerEntry = Pick<Transaction, "type" | "amount" | "currency">;

export type LifetimeTotals = RangeTotals & {
  /**
   * False when the read stopped at LEDGER_MAX_PAGES with rows still behind it.
   * The tile then says so rather than printing a total it can't stand behind.
   */
  complete: boolean;
};

/**
 * Income, expense and net across the entire settled ledger, in TL.
 *
 * Deliberately takes EVERY settled row rather than the page the table renders:
 * the transactions query is capped at TRANSACTION_PAGE, so summing what the
 * page already has would silently mean "net over the last 500 transactions"
 * under a label that says all time. Rows in a currency with no rate are
 * excluded and reported, exactly as everywhere else.
 */
export function sumLifetime(
  entries: LedgerEntry[],
  rates: FxRates,
  complete = true
): { totals: LifetimeTotals; skippedCurrencies: Set<string> } {
  const skipped = new Set<string>();
  let income = 0;
  let expense = 0;
  let count = 0;

  for (const entry of entries) {
    const converted = toTRY(Number(entry.amount), entry.currency, rates);
    if (converted === null) {
      skipped.add(entry.currency);
      continue;
    }
    count++;
    if (entry.type === "income") income += converted;
    else expense += converted;
  }

  return {
    totals: {
      income: Math.round(income),
      expense: Math.round(expense),
      net: Math.round(income - expense),
      count,
      complete,
    },
    skippedCurrencies: skipped,
  };
}

// ---------------------------------------------------------------------------
// Recurring, inside a window — "what did the subscriptions actually bill?"
// ---------------------------------------------------------------------------

export type RecurringRangeTotals = RangeTotals & {
  /** How many distinct items billed at least once in the window. */
  items: number;
};

/**
 * What the recurring items billed inside one inclusive window, in TL.
 *
 * Occurrences, not monthly-equivalents: over "1 Jan – 15 Aug" a yearly domain
 * renewal charges once and a monthly retainer charges eight times, and dividing
 * the yearly one by twelve would answer a question nobody asked. Each occurrence
 * is recomputed from the billing DAY rather than stepped from the previous one,
 * for the clamping reason spelled out on `nextBillingOn`.
 *
 * An item is silent before it starts and from its cancellation date onward — the
 * day it was canceled is the day it stopped billing, not one more charge.
 */
export function sumRecurringRange(
  items: RecurringItem[],
  rates: FxRates,
  range: DateRange
): { totals: RecurringRangeTotals; skippedCurrencies: Set<string> } {
  const skipped = new Set<string>();
  let income = 0;
  let expense = 0;
  let count = 0;
  let billedItems = 0;

  for (const item of items) {
    const converted = toTRY(Number(item.amount), item.currency, rates);
    const day = billingDay(item);
    const dates: string[] = [];

    if (item.cadence === "yearly") {
      const month = Number(item.started_on.slice(5, 7));
      const first = Number(range.from.slice(0, 4));
      const last = Number(range.to.slice(0, 4));
      for (let year = first; year <= last; year++) dates.push(onDayOf(year, month, day));
    } else {
      // Walk months, not days: at most ~12 steps for a year-long window.
      let year = Number(range.from.slice(0, 4));
      let month = Number(range.from.slice(5, 7));
      const end = range.to.slice(0, 7);
      while (`${year}-${String(month).padStart(2, "0")}` <= end) {
        dates.push(onDayOf(year, month, day));
        if (month === 12) {
          year++;
          month = 1;
        } else {
          month++;
        }
      }
    }

    let hits = 0;
    for (const date of dates) {
      // Plain string compare — see the DateRange doc comment.
      if (date < range.from || date > range.to) continue;
      if (date < item.started_on) continue;
      if (item.canceled_on !== null && date >= item.canceled_on) continue;
      hits++;
    }
    if (hits === 0) continue;

    if (converted === null) {
      skipped.add(item.currency);
      continue;
    }
    billedItems++;
    count += hits;
    if (item.type === "income") income += converted * hits;
    else expense += converted * hits;
  }

  return {
    totals: {
      income: Math.round(income),
      expense: Math.round(expense),
      net: Math.round(income - expense),
      count,
      items: billedItems,
    },
    skippedCurrencies: skipped,
  };
}
