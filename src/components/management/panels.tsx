import Link from "next/link";
import { FileText, ReceiptText, RefreshCcw, ScrollText } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FxEditor } from "@/components/management/fx-editor";
import {
  CashflowChart,
  RecurringBreakdown,
  type BreakdownItem,
} from "@/components/management/finance-charts";
import { SpendingComparison } from "@/components/management/finance-comparison";
import { RecurringRow, TransactionRow } from "@/components/management/finance-rows";
import { ExportButton } from "@/components/management/export-button";
import {
  buildCashflowSeries,
  formatTRY,
  billingDay,
  isActiveRecurring,
  nextBillingOn,
  monthKey,
  monthlyAmount,
  sumLifetime,
  toTRY,
  TRANSACTION_PAGE,
  type FxRates,
  type LedgerEntry,
} from "@/lib/finance";
import { cn, formatDate, todayInIstanbul } from "@/lib/utils";
import type {
  Contract,
  ContractStatus,
  FxRate,
  RecurringItem,
  Transaction,
} from "@/lib/types";

const CONTRACT_TONE: Record<ContractStatus, BadgeTone> = {
  draft: "faint",
  active: "green",
  expired: "amber",
  terminated: "danger",
};

function StatTile({
  label,
  value,
  sub,
  tone,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "green" | "red";
  className?: string;
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
    </div>
  );
}

export function FinancePanel({
  transactions,
  recurring,
  fxRates,
  ledger,
  ledgerComplete,
}: {
  transactions: Transaction[];
  recurring: RecurringItem[];
  fxRates: FxRate[];
  /** Every settled transaction, ever — the all-time tile's basis. */
  ledger: LedgerEntry[];
  ledgerComplete: boolean;
}) {
  const rates: FxRates = {};
  let ratesUpdatedAt: string | null = null;
  for (const r of fxRates) {
    rates[r.currency] = Number(r.rate_to_try);
    if (!ratesUpdatedAt || r.updated_at > ratesUpdatedAt) ratesUpdatedAt = r.updated_at;
  }

  // Pending money hasn't moved — it stays out of the tiles and the cash-flow
  // chart, which answer "what actually happened", and lives only in the table
  // (amber badge) until someone marks it paid.
  const settled = transactions.filter((t) => t.status === "paid");

  // This month, in TL
  const today = todayInIstanbul();
  const thisMonth = monthKey(today);
  let monthIncome = 0;
  let monthExpense = 0;
  const skipped = new Set<string>();
  for (const t of settled) {
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
  for (const item of recurring.filter(isActiveRecurring)) {
    const value = toTRY(monthlyAmount(item), item.currency, rates);
    if (value === null) {
      skipped.add(item.currency);
      continue;
    }
    if (item.type === "income") recurringIn += value;
    else recurringOut += value;
  }

  // The transactions query is capped, so the oldest row that came back is the
  // real floor of what any range can be measured against. Null when the ledger
  // is small enough to have arrived whole — then nothing is missing and the
  // year-on-year panel has no caveat to raise.
  const oldestLoaded =
    transactions.length >= TRANSACTION_PAGE
      ? transactions[transactions.length - 1].occurred_on
      : null;

  const { series, skippedCurrencies } = buildCashflowSeries(settled, rates);
  for (const c of skippedCurrencies) skipped.add(c);

  // All time. Off `ledger`, never off `transactions` — the latter is one capped
  // page, and "net over the last 500 rows" under an all-time label is a lie the
  // reader has no way to spot.
  const { totals: lifetime, skippedCurrencies: skippedEver } = sumLifetime(
    ledger,
    rates,
    ledgerComplete
  );
  for (const c of skippedEver) skipped.add(c);

  const breakdown: BreakdownItem[] = recurring
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
      {skipped.size > 0 && (
        <p className="mb-4 rounded-md border border-amber/30 bg-amber/10 px-3 py-2 text-[calc(13px*var(--text-scale,1))] text-amber">
          Some {[...skipped].join(" and ")} amounts are excluded from TL totals —
          set the missing rate below to include them.
        </p>
      )}

      <div className="grid gap-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatTile
            label="Total net, all time"
            value={formatTRY(lifetime.net)}
            sub={
              lifetime.count === 0
                ? "No settled transactions yet"
                : `${formatTRY(lifetime.income)} in · ${formatTRY(lifetime.expense)} out${lifetime.complete ? ` · ${lifetime.count} settled` : " · partial, ledger past the read cap"}`
            }
            tone={lifetime.net >= 0 ? "green" : "red"}
            className="col-span-2 lg:col-span-1"
          />
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
          <PanelHeader
            title="Compare a range"
            action={
              <span className="text-[calc(12px*var(--text-scale,1))] text-faint">
                TL equivalent, settled only
              </span>
            }
          />
          <SpendingComparison
            transactions={settled}
            rates={rates}
            today={today}
            oldestLoaded={oldestLoaded}
          />
        </Panel>

        <Panel>
          <PanelHeader title="Cash flow" />
          {hasChartData ? (
            <CashflowChart data={series} />
          ) : (
            <p className="p-4 text-[calc(13px*var(--text-scale,1))] text-faint">
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
              <p className="p-4 text-[calc(13px*var(--text-scale,1))] text-faint">
                Active subscriptions and retainers chart here.
              </p>
            )}
          </Panel>
        </div>

        <Panel>
          <PanelHeader
            title={`Recurring items (${recurring.length})`}
            action={
              <ExportButton
                filename="recurring-items.csv"
                columns={["Name", "Type", "Amount", "Currency", "Cadence", "Bills on", "Next bill", "Counterparty", "Started", "Canceled"]}
                rows={recurring.map((r) => [
                  r.name,
                  r.type,
                  Number(r.amount),
                  r.currency,
                  r.cadence,
                  billingDay(r),
                  nextBillingOn(r) ?? "",
                  r.counterparty ?? "",
                  r.started_on,
                  r.canceled_on ?? "",
                ])}
              />
            }
          />
          {recurring.length === 0 ? (
            <EmptyState
              icon={RefreshCcw}
              title="No recurring items"
              hint="Subscriptions you pay and retainers you receive — one-time payments go in transactions."
            />
          ) : (
            <ul className="divide-y divide-line">
              {recurring.map((item) => (
                <RecurringRow key={item.id} item={item} rates={rates} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Transactions"
            action={
              <ExportButton
                filename="transactions.csv"
                columns={["Date", "Type", "Amount", "Currency", "Status", "Client", "Notes"]}
                rows={transactions.map((t) => [
                  t.occurred_on,
                  t.type,
                  Number(t.amount),
                  t.currency,
                  t.status,
                  t.client ?? "",
                  t.notes ?? "",
                ])}
              />
            }
          />
          {transactions.length === 0 ? (
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
                    <th className="px-4 py-2.5 text-xs font-medium text-faint">Status</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-faint">Client</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-faint">Notes</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {transactions.slice(0, 50).map((t) => (
                    <TransactionRow key={t.id} transaction={t} />
                  ))}
                </tbody>
              </table>
              {transactions.length > 50 && (
                <p className="px-4 py-2 text-xs text-faint">
                  Showing the latest 50 of {transactions.length}.
                </p>
              )}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

export function ContractsPanel({ contracts }: { contracts: Contract[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface">
      {contracts.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No contracts yet"
          hint="Track every agreement with its dates, status, and the signed PDF."
        />
      ) : (
        <ul className="divide-y divide-line">
          {contracts.map((contract) => (
            <li key={contract.id}>
              <Link
                href={`/management/contracts/${contract.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors duration-150 hover:bg-raised/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-ink">
                    {contract.title}
                    {contract.file_path && (
                      <FileText className="size-3.5 text-faint" aria-hidden />
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-faint">
                    {contract.client}
                    {contract.starts_on &&
                      ` · ${formatDate(contract.starts_on)}${contract.ends_on ? ` → ${formatDate(contract.ends_on)}` : ""}`}
                  </p>
                </div>
                <Badge tone={CONTRACT_TONE[contract.status]}>{contract.status}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
