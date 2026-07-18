import type { Metadata } from "next";
import { Suspense } from "react";
import { Plus, RefreshCcw } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { LinkButton } from "@/components/ui/link-button";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { TabbedPanels } from "@/components/shell/tabbed-panels";
import { ContractsPanel, FinancePanel } from "@/components/management/panels";
import type { Contract, FxRate, RecurringItem, Transaction } from "@/lib/types";

export const metadata: Metadata = { title: "Finance" };

export default async function ManagementPage() {
  const ctx = await requireSection("management");

  const [
    { data: transactions },
    { data: recurring },
    { data: fxRates },
    { data: contracts },
  ] = await Promise.all([
    ctx.supabase
      .from("transactions")
      .select("*")
      .eq("is_demo", ctx.showcase)
      .order("occurred_on", { ascending: false })
      .limit(500),
    ctx.supabase
      .from("recurring_items")
      .select("*")
      .eq("is_demo", ctx.showcase)
      .order("created_at", { ascending: false }),
    ctx.supabase.from("fx_rates").select("*"),
    ctx.supabase
      .from("contracts")
      .select("*")
      .eq("is_demo", ctx.showcase)
      .order("updated_at", { ascending: false }),
  ]);

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
                transactions={(transactions ?? []) as Transaction[]}
                recurring={(recurring ?? []) as RecurringItem[]}
                fxRates={(fxRates ?? []) as FxRate[]}
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
              <ContractsPanel contracts={(contracts ?? []) as Contract[]} />
            ),
          },
        ]}
      />
    </Suspense>
  );
}
