import Link from "next/link";
import { Building2 } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { PostCard } from "@/components/marketing/post-card";
import { LinksPanel } from "@/components/marketing/links-panel";
import { formatTRY, monthKey, toTRY, type FxRates } from "@/lib/finance";
import { addDays, todayInIstanbul } from "@/lib/utils";
import type {
  Client,
  ClientStatus,
  FxRate,
  MarketingLink,
  MarketingPost,
  MembersMap,
  Transaction,
} from "@/lib/types";

const CLIENT_STATUS_TONE: Record<ClientStatus, BadgeTone> = {
  active: "green",
  paused: "amber",
  ended: "faint",
};

const ENGAGEMENT_LABEL = {
  retainer: "Retainer",
  project: "Project",
  ad_fee: "% of ad spend",
} as const;

/**
 * GENERAL — the section's front door: one screen that answers "how is the
 * marketing work doing, across every client" before anyone opens a workspace.
 * Four numbers, the clients themselves (each row a door into its workspace,
 * with its own money beside it), the week ahead, and the team's link shelf.
 * Everything is a summary of rows other screens own — nothing here is
 * editable, so nothing can disagree with them.
 */
export function Overview({
  clients,
  posts,
  transactions,
  fxRates,
  links,
  members,
  canWrite,
}: {
  clients: Client[];
  posts: MarketingPost[];
  /** Already filtered to category='marketing'. */
  transactions: Transaction[];
  fxRates: FxRate[];
  /** The team shelf — client_id null only. */
  links: MarketingLink[];
  members: MembersMap;
  canWrite: boolean;
}) {
  const today = todayInIstanbul();
  const thisMonth = monthKey(today);
  const weekAhead = addDays(today, 7);

  const rates: FxRates = {};
  for (const r of fxRates) rates[r.currency] = Number(r.rate_to_try);

  const clientNames: Record<string, string> = {};
  for (const c of clients) clientNames[c.id] = c.name;

  const postedThisMonth = posts.filter(
    (p) =>
      p.status === "posted" &&
      p.publish_on !== null &&
      monthKey(p.publish_on) === thisMonth
  ).length;

  const thisWeek = posts
    .filter(
      (p) =>
        p.status !== "posted" &&
        p.publish_on !== null &&
        p.publish_on >= today &&
        p.publish_on <= weekAhead
    )
    .sort((a, b) => (a.publish_on! < b.publish_on! ? -1 : 1));

  const overdueCount = posts.filter(
    (p) => p.status !== "posted" && p.publish_on !== null && p.publish_on < today
  ).length;

  // Money, per client and in total, from settled ledger rows.
  let monthSpend = 0;
  const spendByClient = new Map<string, number>();
  for (const t of transactions) {
    if (t.status !== "paid") continue;
    const value = toTRY(Number(t.amount), t.currency, rates);
    if (value === null) continue;
    const signed = t.type === "expense" ? value : -value;
    if (monthKey(t.occurred_on) === thisMonth) {
      monthSpend += signed;
      if (t.marketing_client_id) {
        spendByClient.set(
          t.marketing_client_id,
          (spendByClient.get(t.marketing_client_id) ?? 0) + signed
        );
      }
    }
  }

  const postCounts = new Map<string, { inFlight: number; postedMonth: number }>();
  for (const p of posts) {
    const tally = postCounts.get(p.client_id) ?? { inFlight: 0, postedMonth: 0 };
    if (p.status !== "posted") tally.inFlight++;
    else if (p.publish_on !== null && monthKey(p.publish_on) === thisMonth)
      tally.postedMonth++;
    postCounts.set(p.client_id, tally);
  }

  const activeClients = clients.filter((c) => c.status === "active");
  // Active first, then paused; ended clients drop off the overview entirely —
  // they still exist under the Clients tab.
  const visibleClients = clients.filter((c) => c.status !== "ended");

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Active clients" value={String(activeClients.length)} />
        <StatTile label="Posted this month" value={String(postedThisMonth)} />
        <StatTile
          label="Publishing this week"
          value={String(thisWeek.length)}
          sub={overdueCount > 0 ? `${overdueCount} past their date` : undefined}
          tone={overdueCount > 0 ? "red" : undefined}
        />
        <StatTile label="Spent this month" value={formatTRY(monthSpend)} />
      </div>

      <Panel>
        <PanelHeader
          title="Clients"
          action={
            <span className="text-xs text-faint">
              Each one opens its workspace — posts, schedule, budget, links.
            </span>
          }
        />
        {visibleClients.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No clients yet"
            hint="A client is the root of everything here: their posts, their campaigns, their budget. Add the first one under the Clients tab."
          />
        ) : (
          <ul className="divide-y divide-line">
            {visibleClients.map((client) => {
              const tally = postCounts.get(client.id) ?? { inFlight: 0, postedMonth: 0 };
              const spend = spendByClient.get(client.id) ?? 0;
              return (
                <li key={client.id}>
                  <Link
                    href={`/marketing/clients/${client.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors duration-150 hover:bg-raised/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{client.name}</p>
                      <p className="mt-0.5 text-xs text-faint">
                        {ENGAGEMENT_LABEL[client.engagement_kind]}
                        {client.monthly_deliverables !== null &&
                          ` · ${client.monthly_deliverables} posts a month`}
                      </p>
                    </div>

                    {/* Numbers, not sentences — mono and right-aligned so the
                        eye can run down the column and compare. */}
                    <dl className="flex items-center gap-4 text-xs">
                      <Figure label="in flight" value={String(tally.inFlight)} />
                      <Figure label="posted this month" value={String(tally.postedMonth)} />
                      <Figure label="spent this month" value={formatTRY(spend)} />
                    </dl>

                    <Badge tone={CLIENT_STATUS_TONE[client.status]}>
                      {client.status}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="This week"
          action={
            <span className="text-xs text-faint">
              Publishes in the next 7 days, across every client.
            </span>
          }
        />
        {thisWeek.length === 0 ? (
          <p className="px-4 py-5 text-[calc(13px*var(--text-scale,1))] text-faint">
            Nothing dated for the coming week. The Schedule tab has the full
            calendar.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {thisWeek.map((post) => (
              <li key={post.id}>
                <PostCard
                  post={post}
                  members={members}
                  clientName={clientNames[post.client_id]}
                  canWrite={canWrite}
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <LinksPanel links={links} canWrite={canWrite} />
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "red";
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-[calc(13px*var(--text-scale,1))] text-muted">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold tracking-tight">{value}</p>
      {sub && (
        <p className={`mt-0.5 text-xs ${tone === "red" ? "text-danger" : "text-faint"}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <dd className="font-mono text-sm text-ink tabular-nums">{value}</dd>
      <dt className="text-[calc(11px*var(--text-scale,1))] text-faint">{label}</dt>
    </div>
  );
}
