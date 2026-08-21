import { ReceiptText } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { CashflowChart } from "@/components/management/finance-charts";
import {
  buildCashflowSeries,
  formatTRY,
  monthKey,
  toTRY,
  type FxRates,
} from "@/lib/finance";
import { CHANNEL_OPTIONS, optionLabel } from "@/lib/options";
import { cn, formatDate, todayInIstanbul } from "@/lib/utils";
import type { FxRate, MarketingCampaign, Transaction } from "@/lib/types";

/**
 * BUDGET — the marketing lens over the company ledger (0069).
 *
 * Every number here is a `transactions` row with category='marketing' — the
 * SAME rows the Finance tab shows, so the two can never disagree. What this
 * screen adds is the client and campaign dimensions: where the money went,
 * per client, against what was planned.
 *
 * Used twice: the section-wide Budget tab (all clients, with a per-client
 * breakdown) and inside one client's workspace (`clientId` set — rows arrive
 * pre-filtered and the per-client panel is skipped as noise).
 *
 * `spend_actual` (the ad-platform import column) is deliberately NOT summed
 * into these totals — that's money on an ad account, a different pocket. When
 * a campaign has it, it renders as its own labelled figure.
 */
export function BudgetPanel({
  transactions,
  campaigns,
  fxRates,
  clientNames,
  clientId,
}: {
  /** Already filtered to category='marketing' (and to the client, when clientId is set). */
  transactions: Transaction[];
  campaigns: MarketingCampaign[];
  fxRates: FxRate[];
  clientNames?: Record<string, string>;
  clientId?: string;
}) {
  const rates: FxRates = {};
  for (const r of fxRates) rates[r.currency] = Number(r.rate_to_try);

  // Pending money hasn't moved — same rule as the Finance tab.
  const settled = transactions.filter((t) => t.status === "paid");
  const skipped = new Set<string>();

  const thisMonth = monthKey(todayInIstanbul());
  let monthSpend = 0;
  let totalSpend = 0;
  const byCampaign = new Map<string, number>();
  const byClient = new Map<string | null, { month: number; total: number }>();

  for (const t of settled) {
    const value = toTRY(Number(t.amount), t.currency, rates);
    if (value === null) {
      skipped.add(t.currency);
      continue;
    }
    const signed = t.type === "expense" ? value : -value;
    totalSpend += signed;
    const inMonth = monthKey(t.occurred_on) === thisMonth;
    if (inMonth) monthSpend += signed;
    if (t.campaign_id) {
      byCampaign.set(t.campaign_id, (byCampaign.get(t.campaign_id) ?? 0) + signed);
    }
    const clientBucket =
      byClient.get(t.marketing_client_id) ?? { month: 0, total: 0 };
    clientBucket.total += signed;
    if (inMonth) clientBucket.month += signed;
    byClient.set(t.marketing_client_id, clientBucket);
  }

  const { series } = buildCashflowSeries(settled, rates, 6);
  const hasChartData = series.some((m) => m.income > 0 || m.expense > 0);

  // Campaigns worth a budget row: anything not merely an idea, newest first.
  const budgetRows = campaigns
    .filter((c) => c.status !== "idea")
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const clientBreakdown = [...byClient.entries()]
    .map(([id, sums]) => ({
      id,
      name: id === null ? "General (no client)" : (clientNames?.[id] ?? "Client"),
      ...sums,
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="grid gap-6">
      {skipped.size > 0 && (
        <p className="rounded-md border border-amber/30 bg-amber/10 px-3 py-2 text-[calc(13px*var(--text-scale,1))] text-amber">
          Some {[...skipped].join(" and ")} amounts are excluded from TL totals —
          the rate is set on the Finance tab.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Spent this month" value={formatTRY(monthSpend)} />
        <StatTile label="Spent all time" value={formatTRY(totalSpend)} />
        <StatTile
          label="Planned budgets"
          value={formatTRY(
            budgetRows.reduce((sum, c) => {
              const b = c.budget === null ? null : toTRY(Number(c.budget), c.currency, rates);
              return sum + (b ?? 0);
            }, 0)
          )}
          sub="Planned + running + done campaigns"
        />
      </div>

      <Panel>
        <PanelHeader title="Marketing cash flow" />
        {hasChartData ? (
          <CashflowChart data={series} />
        ) : (
          <p className="p-4 text-[calc(13px*var(--text-scale,1))] text-faint">
            The chart draws itself once expenses are logged.
          </p>
        )}
      </Panel>

      {!clientId && clientBreakdown.length > 0 && (
        <Panel>
          <PanelHeader
            title="Per client"
            action={<span className="text-xs text-faint">Where the money went.</span>}
          />
          <ul className="divide-y divide-line">
            {clientBreakdown.map((row) => (
              <li
                key={row.id ?? "general"}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-2.5"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {row.name}
                </span>
                <span className="font-mono text-xs text-muted tabular-nums">
                  {formatTRY(row.month)} this month
                </span>
                <span className="font-mono text-sm text-ink tabular-nums">
                  {formatTRY(row.total)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel>
        <PanelHeader
          title="Per campaign"
          action={
            <span className="text-xs text-faint">
              Planned budget vs what the ledger says went out.
            </span>
          }
        />
        {budgetRows.length === 0 ? (
          <p className="px-4 py-5 text-[calc(13px*var(--text-scale,1))] text-faint">
            Campaigns with a budget appear here once one moves past the idea stage.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {budgetRows.map((campaign) => {
              const spent = byCampaign.get(campaign.id) ?? 0;
              const budget =
                campaign.budget === null
                  ? null
                  : toTRY(Number(campaign.budget), campaign.currency, rates);
              const over = budget !== null && spent > budget;
              const ratio =
                budget !== null && budget > 0
                  ? Math.min(1, Math.max(0, spent / budget))
                  : null;
              return (
                <li key={campaign.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                      {campaign.name}
                    </span>
                    {!clientId && campaign.client_id && (
                      <span className="text-xs text-muted">
                        {clientNames?.[campaign.client_id]}
                      </span>
                    )}
                    <span className="text-xs text-muted">
                      {optionLabel(CHANNEL_OPTIONS, campaign.channel)}
                    </span>
                    <Badge tone={campaign.status === "running" ? "green" : "neutral"}>
                      {campaign.status}
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className={cn("font-mono tabular-nums", over ? "text-danger" : "text-muted")}>
                      {formatTRY(spent)}
                      {budget !== null && ` of ${formatTRY(budget)}`}
                      {over && " — over budget"}
                    </span>
                    {Number(campaign.spend_actual) > 0 && (
                      <span className="font-mono text-faint tabular-nums">
                        + {formatTRY(Number(campaign.spend_actual))} on the ad platform
                      </span>
                    )}
                  </div>
                  {ratio !== null && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                      <div
                        className={cn("h-full rounded-full", over ? "bg-danger" : "bg-primary-dim")}
                        style={{ width: `${Math.round(ratio * 100)}%` }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Marketing expenses"
          action={
            <span className="text-xs text-faint">
              The same rows the Finance tab shows, filtered to marketing.
            </span>
          }
        />
        {transactions.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="Nothing logged yet"
            hint="Money spent from pocket on marketing — gear, boosts, freelancers. Logging it here also files it in the company ledger."
          />
        ) : (
          <ul className="divide-y divide-line">
            {transactions.slice(0, 50).map((t) => {
              const campaign = t.campaign_id
                ? campaigns.find((c) => c.id === t.campaign_id)
                : null;
              return (
                <li
                  key={t.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5"
                >
                  <span className="font-mono text-xs text-faint tabular-nums">
                    {formatDate(t.occurred_on)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {t.notes ?? campaign?.name ?? "Marketing expense"}
                  </span>
                  {!clientId && t.marketing_client_id && (
                    <span className="text-xs text-muted">
                      {clientNames?.[t.marketing_client_id]}
                    </span>
                  )}
                  {campaign && (
                    <span className="text-xs text-faint">{campaign.name}</span>
                  )}
                  {t.status === "pending" && <Badge tone="amber">pending</Badge>}
                  <span
                    className={cn(
                      "font-mono text-sm tabular-nums",
                      t.type === "expense" ? "text-ink" : "text-primary-dim"
                    )}
                  >
                    {t.type === "expense" ? "−" : "+"}
                    {Number(t.amount).toLocaleString("tr-TR")} {t.currency}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/** Same tile as the Finance panel's — local by the same convention. */
function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-[calc(13px*var(--text-scale,1))] text-muted">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-faint">{sub}</p>}
    </div>
  );
}
