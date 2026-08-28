import type { Metadata } from "next";
import { Suspense } from "react";
import { Plus, RefreshCcw } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { rowsOrThrow } from "@/lib/data/query";
import { LinkButton } from "@/components/ui/link-button";
import {
  LEDGER_MAX_PAGES,
  LEDGER_PAGE,
  TRANSACTION_PAGE,
  type LedgerEntry,
} from "@/lib/finance";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { TabbedPanels } from "@/components/shell/tabbed-panels";
import { ContractsPanel, FinancePanel } from "@/components/management/panels";
import type { Contract, FxRate, RecurringItem, Transaction } from "@/lib/types";

export const metadata: Metadata = { title: "Finance" };

type Supabase = Awaited<ReturnType<typeof requireSection>>["supabase"];

/**
 * One page of the settled ledger — type/amount/currency only, because the
 * all-time total needs nothing else and the ledger can be long.
 *
 * Ordered by id rather than by date: paging is only stable under a total
 * order, and two transactions can share an `occurred_on`, which would let a
 * row slip between pages (counted twice, or not at all).
 */
function settledLedgerPage(supabase: Supabase, showcase: boolean, page: number) {
  return supabase
    .from("transactions")
    .select("type, amount, currency")
    .eq("is_demo", showcase)
    .eq("status", "paid")
    .order("id", { ascending: true })
    .range(page * LEDGER_PAGE, (page + 1) * LEDGER_PAGE - 1);
}

export default async function ManagementPage() {
  const ctx = await requireSection("management");

  const [transactions, recurring, fxRates, contracts, firstLedgerPage] =
    await Promise.all([
      rowsOrThrow(
        ctx.supabase
          .from("transactions")
          .select("*")
          .eq("is_demo", ctx.showcase)
          .order("occurred_on", { ascending: false })
          .limit(TRANSACTION_PAGE),
        "transactions"
      ),
      rowsOrThrow(
        ctx.supabase
          .from("recurring_items")
          .select("*")
          .eq("is_demo", ctx.showcase)
          .order("created_at", { ascending: false }),
        "recurring_items"
      ),
      rowsOrThrow(ctx.supabase.from("fx_rates").select("*"), "fx_rates"),
      rowsOrThrow(
        ctx.supabase
          .from("contracts")
          .select("*")
          .eq("is_demo", ctx.showcase)
          .order("updated_at", { ascending: false }),
        "contracts"
      ),
      // The all-time total is measured against the WHOLE settled ledger, not
      // the capped page above — see sumLifetime. The first page rides in the
      // one wave; the loop below only costs a round-trip if it came back full,
      // which for a ledger under LEDGER_PAGE rows it never does.
      rowsOrThrow(
        settledLedgerPage(ctx.supabase, ctx.showcase, 0),
        "transactions (all time)"
      ),
    ]);

  const ledger = firstLedgerPage as LedgerEntry[];
  let ledgerComplete = ledger.length < LEDGER_PAGE;
  for (let page = 1; !ledgerComplete && page < LEDGER_MAX_PAGES; page++) {
    const next = (await rowsOrThrow(
      settledLedgerPage(ctx.supabase, ctx.showcase, page),
      "transactions (all time)"
    )) as LedgerEntry[];
    ledger.push(...next);
    ledgerComplete = next.length < LEDGER_PAGE;
  }

  return (
    <Suspense>
      <LiveRefresh tables={["transactions", "recurring_items", "contracts"]} />
      <TabbedPanels
        title="Kagu Management"
        description="The company ledger — everything in TL."
        ariaLabel="Management subsections"
        panels={[
          {
            key: "finance",
            label: "Finance",
            action: (
              <span className="flex gap-2">
                <LinkButton href="/management/finance/new-recurring" variant="outline">
                  <RefreshCcw className="size-3.5" aria-hidden />
                  New recurring
                </LinkButton>
                <LinkButton href="/management/finance/new-transaction">
                  <Plus className="size-3.5" aria-hidden />
                  New transaction
                </LinkButton>
              </span>
            ),
            content: (
              <FinancePanel
                transactions={transactions as Transaction[]}
                recurring={recurring as RecurringItem[]}
                fxRates={fxRates as FxRate[]}
                ledger={ledger}
                ledgerComplete={ledgerComplete}
              />
            ),
          },
          {
            key: "contracts",
            label: "Contracts",
            action: (
              <LinkButton href="/management/contracts/new">
                <Plus className="size-3.5" aria-hidden />
                New contract
              </LinkButton>
            ),
            content: (
              <ContractsPanel contracts={contracts as Contract[]} />
            ),
          },
        ]}
      />
    </Suspense>
  );
}
