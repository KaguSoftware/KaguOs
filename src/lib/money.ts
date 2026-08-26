import type { InvoiceCurrency } from "@/lib/types";

/**
 * Money as the portal shows it: a bucket per currency, never one converted
 * number.
 *
 * ── Why these live outside `lib/data/portal.ts` ─────────────────────────────
 *
 * They were in it, and that was fine for as long as every component that
 * rendered money was a server component. `lib/data/portal.ts` opens with
 * `import "server-only"`, so the moment a CLIENT component imports anything
 * from it — even a three-line pure function — the build fails with
 * "'server-only' cannot be imported from a Client Component module", and the
 * error names the leaf, not the import that dragged it in.
 *
 * That happened the first time a client component (the portal's four-column
 * progress view) needed `portal/bits.tsx`, which renders `<Money>`. The shape
 * helpers are pure — no session, no fetch, no clock — so they belong in a
 * module either side can import, and the server-only module keeps only the
 * things that genuinely read the database.
 *
 * `lib/data/portal.ts` re-exports them, so existing server call sites are
 * unchanged.
 */
export type MoneyByCurrency = Partial<Record<InvoiceCurrency, number>>;

/**
 * True when there is anything worth showing.
 *
 * Half a cent is the threshold rather than zero: a bucket that has been
 * added to and subtracted from lands on 1e-13 rather than on 0, and a
 * "£0.00 outstanding" row is worse than no row.
 */
export function hasMoney(bucket: MoneyByCurrency): boolean {
  return Object.values(bucket).some((value) => (value ?? 0) > 0.005);
}

/** Currency/amount pairs, largest first, for a stack of money lines. */
export function moneyLines(
  bucket: MoneyByCurrency
): { currency: InvoiceCurrency; amount: number }[] {
  return (Object.entries(bucket) as [InvoiceCurrency, number][])
    .filter(([, amount]) => amount > 0.005)
    .sort((a, b) => b[1] - a[1])
    .map(([currency, amount]) => ({ currency, amount }));
}
