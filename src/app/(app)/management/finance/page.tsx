import type { Metadata } from "next";
import { Plus, ReceiptText, RefreshCcw } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { SectionTabs } from "@/components/shell/section-tabs";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { MANAGEMENT_TABS } from "@/components/management/tabs";
import { FxEditor } from "@/components/management/fx-editor";
import {
  CashflowChart,
  RecurringBreakdown,
  type BreakdownItem,
} from "@/components/management/finance-charts";
import { RecurringRow, TransactionRow } from "@/components/management/finance-rows";
import {
  buildCashflowSeries,
  formatTRY,
  isActiveRecurring,
  monthKey,
  monthlyAmount,
  toTRY,
  type FxRates,
} from "@/lib/finance";
import { cn } from "@/lib/utils";
import type { FxRate, RecurringItem, Transaction } from "@/lib/types";

export const metadata: Metadata = { title: "Finance" };

function StatTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "green" | "red";
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-[13px] text-muted">{label}</p>
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
    </div>
  );
}

export default async function FinancePage() {
  const ctx = await requireSection("management");

  const [{ data: transactions }, { data: recurring }, { data: fxRates }] =
    await Promise.all([
      ctx.supabase
        .from("transactions")
        .select("*")
        .order("occurred_on", { ascending: false })
        .limit(500),
      ctx.supabase
        .from("recurring_items")
        .select("*")
        .order("created_at", { ascending: false }),
      ctx.supabase.from("fx_rates").select("*"),
    ]);

  const txns = (transactions ?? []) as Transaction[];
  const recs = (recurring ?? []) as RecurringItem[];
  const rateRows = (fxRates ?? []) as FxRate[];

  const rates: FxRates = {};
  let ratesUpdatedAt: string | null = null;
  for (const r of rateRows) {
    rates[r.currency] = Number(r.rate_to_try);
    if (!ratesUpdatedAt || r.updated_at > ratesUpdatedAt) ratesUpdatedAt = r.updated_at;
  }

  // This month, in TL
  const thisMonth = monthKey(new Date().toISOString().slice(0, 10));
  let monthIncome = 0;
  let monthExpense = 0;
  const skipped = new Set<string>();
  for (const t of txns) {
    if (monthKey(t.occurred_on) !== thisMonth) continue;
    const value = toTRY(Number(t.amount), t.currency, rates);
    if (value === null) {
      skipped.add(t.currency);
      continue;
    }
    if (t.type === "income") monthIncome += value;
    else monthExpense += value;
  }

  // Recurring, monthly-equivalent TL
  let recurringIn = 0;
  let recurringOut = 0;
  for (const item of recs.filter(isActiveRecurring)) {
    const value = toTRY(monthlyAmount(item), item.currency, rates);
    if (value === null) {
      skipped.add(item.currency);
      continue;
    }
    if (item.type === "income") recurringIn += value;
    else recurringOut += value;
  }

  const { series, skippedCurrencies } = buildCashflowSeries(txns, rates);
  for (const c of skippedCurrencies) skipped.add(c);

  const breakdown: BreakdownItem[] = recs
    .filter(isActiveRecurring)
    .map((item) => ({
      name: item.name,
      value: Math.round(toTRY(monthlyAmount(item), item.currency, rates) ?? 0),
      type: item.type,
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  const hasChartData = series.some((m) => m.income > 0 || m.expense > 0);

  return (
    <>
      <PageHeader
        title="Kagu Management"
        description="The company ledger — everything in TL."
        action={
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
        }
      />
      <SectionTabs active="finance" tabs={MANAGEMENT_TABS} />

      {skipped.size > 0 && (
        <p className="mb-4 rounded-md border border-amber/30 bg-amber/10 px-3 py-2 text-[13px] text-amber">
          Some {[...skipped].join(" and ")} amounts are excluded from TL totals —
          set the missing rate below to include them.
        </p>
      )}

      <div className="grid gap-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="This month in" value={formatTRY(monthIncome)} tone="green" />
          <StatTile label="This month out" value={formatTRY(monthExpense)} tone="red" />
          <StatTile
            label="This month net"
            value={formatTRY(monthIncome - monthExpense)}
            tone={monthIncome - monthExpense >= 0 ? "green" : "red"}
          />
          <StatTile
            label="Recurring net / month"
            value={formatTRY(recurringIn - recurringOut)}
            sub={`${formatTRY(recurringIn)} in · ${formatTRY(recurringOut)} out`}
            tone={recurringIn - recurringOut >= 0 ? "green" : "red"}
          />
        </div>

        <Panel>
          <PanelHeader title="Cash flow" />
          {hasChartData ? (
            <CashflowChart data={series} />
          ) : (
            <p className="p-4 text-[13px] text-faint">
              The chart draws itself once transactions come in.
            </p>
          )}
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="Exchange rates" />
            <FxEditor rates={rates} updatedAt={ratesUpdatedAt} />
          </Panel>
          <Panel>
            <PanelHeader title="Recurring, monthly TL" />
            {breakdown.length > 0 ? (
              <RecurringBreakdown items={breakdown} />
            ) : (
              <p className="p-4 text-[13px] text-faint">
                Active subscriptions and retainers chart here.
              </p>
            )}
          </Panel>
        </div>

        <Panel>
          <PanelHeader title={`Recurring items (${recs.length})`} />
          {recs.length === 0 ? (
            <EmptyState
              icon={RefreshCcw}
              title="No recurring items"
              hint="Subscriptions you pay and retainers you receive — one-time payments go in transactions."
            />
          ) : (
            <ul className="divide-y divide-line">
              {recs.map((item) => (
                <RecurringRow key={item.id} item={item} rates={rates} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Transactions" />
          {txns.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="No transactions yet"
              hint="Every one-time payment, in or out, lives here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="px-4 py-2.5 text-xs font-medium text-faint">Date</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-faint">Type</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">
                      Amount
                    </th>
                    <th className="px-4 py-2.5 text-xs font-medium text-faint">Client</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-faint">Notes</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {txns.slice(0, 50).map((t) => (
                    <TransactionRow key={t.id} transaction={t} />
                  ))}
                </tbody>
              </table>
              {txns.length > 50 && (
                <p className="px-4 py-2 text-xs text-faint">
                  Showing the latest 50 of {txns.length}.
                </p>
              )}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
