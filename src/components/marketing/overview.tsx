import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { LinksPanel } from "@/components/marketing/links-panel";
import { CREATIVE_STATUS_LABELS, CREATIVE_STATUS_TONE } from "@/lib/creatives";
import { formatTRY, monthKey, toTRY, type FxRates } from "@/lib/finance";
import { CHANNEL_OPTIONS, optionLabel } from "@/lib/options";
import { addDays, formatDate, todayInIstanbul } from "@/lib/utils";
import type { Creative, FxRate, MarketingLink, MembersMap, Transaction } from "@/lib/types";

/**
 * GENERAL — the section's front door after the 2026-08-21 pivot: one screen
 * that answers "how is our marketing doing" before anyone opens a sub-tab.
 * Four numbers, the week ahead, what's live, and the link shelf. Everything
 * here is a summary of rows the other tabs own — nothing is editable, so
 * nothing can disagree with them.
 */
export function Overview({
  creatives,
  transactions,
  fxRates,
  links,
  members,
  canWrite,
}: {
  creatives: Creative[];
  /** Already filtered to category='marketing'. */
  transactions: Transaction[];
  fxRates: FxRate[];
  links: MarketingLink[];
  members: MembersMap;
  canWrite: boolean;
}) {
  const today = todayInIstanbul();
  const thisMonth = monthKey(today);
  const weekAhead = addDays(today, 7);

  const rates: FxRates = {};
  for (const r of fxRates) rates[r.currency] = Number(r.rate_to_try);

  const liveThisMonth = creatives.filter(
    (c) =>
      c.status === "live" &&
      c.publish_on !== null &&
      monthKey(c.publish_on) === thisMonth
  ).length;

  const inProduction = creatives.filter(
    (c) => c.status !== "live" && c.status !== "idea"
  ).length;

  const thisWeek = creatives
    .filter(
      (c) =>
        c.status !== "live" &&
        c.publish_on !== null &&
        c.publish_on >= today &&
        c.publish_on <= weekAhead
    )
    .sort((a, b) => (a.publish_on! < b.publish_on! ? -1 : 1));

  const overdueCount = creatives.filter(
    (c) => c.status !== "live" && c.publish_on !== null && c.publish_on < today
  ).length;

  let monthSpend = 0;
  for (const t of transactions) {
    if (t.status !== "paid" || monthKey(t.occurred_on) !== thisMonth) continue;
    const value = toTRY(Number(t.amount), t.currency, rates);
    if (value === null) continue;
    monthSpend += t.type === "expense" ? value : -value;
  }

  const recentlyLive = creatives
    .filter((c) => c.status === "live")
    .sort((a, b) =>
      (b.publish_on ?? b.updated_at) < (a.publish_on ?? a.updated_at) ? -1 : 1
    )
    .slice(0, 8);

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Live this month" value={String(liveThisMonth)} />
        <StatTile label="In production" value={String(inProduction)} />
        <StatTile
          label="Publishing this week"
          value={String(thisWeek.length)}
          sub={overdueCount > 0 ? `${overdueCount} past their date` : undefined}
          tone={overdueCount > 0 ? "red" : undefined}
        />
        <StatTile label="Spent this month" value={formatTRY(monthSpend)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Panel>
          <PanelHeader
            title="This week"
            action={<span className="text-xs text-faint">Publishes in the next 7 days.</span>}
          />
          {thisWeek.length === 0 ? (
            <p className="px-4 py-5 text-[calc(13px*var(--text-scale,1))] text-faint">
              Nothing dated for the coming week. The Schedule tab has the full
              calendar.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {thisWeek.map((creative) => {
                const owner = creative.owner_id ? members[creative.owner_id] : null;
                return (
                  <li
                    key={creative.id}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5"
                  >
                    <span className="font-mono text-xs text-faint tabular-nums">
                      {formatDate(creative.publish_on!)}
                    </span>
                    <Link
                      href={`/marketing/creatives/${creative.id}`}
                      className="min-w-0 flex-1 truncate text-sm text-ink underline-offset-2 hover:text-primary-dim hover:underline"
                    >
                      {creative.title}
                    </Link>
                    {owner && (
                      <span className="text-xs" style={{ color: owner.color }}>
                        {owner.name}
                      </span>
                    )}
                    <Badge tone={CREATIVE_STATUS_TONE[creative.status]}>
                      {CREATIVE_STATUS_LABELS[creative.status]}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Live"
            action={<span className="text-xs text-faint">The latest posts out the door.</span>}
          />
          {recentlyLive.length === 0 ? (
            <p className="px-4 py-5 text-[calc(13px*var(--text-scale,1))] text-faint">
              Nothing live yet — the first published video lands here with its
              link.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {recentlyLive.map((creative) => (
                <li
                  key={creative.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5"
                >
                  <Link
                    href={`/marketing/creatives/${creative.id}`}
                    className="min-w-0 flex-1 truncate text-sm text-ink underline-offset-2 hover:text-primary-dim hover:underline"
                  >
                    {creative.title}
                  </Link>
                  <span className="text-xs text-muted">
                    {optionLabel(CHANNEL_OPTIONS, creative.channel)}
                  </span>
                  {creative.publish_on && (
                    <span className="font-mono text-xs text-faint tabular-nums">
                      {formatDate(creative.publish_on)}
                    </span>
                  )}
                  {creative.published_url && (
                    <a
                      href={creative.published_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
                    >
                      View post
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <LinksPanel links={links} canWrite={canWrite} />
    </div>
  );
}

/** Same tile as the Finance panel's — local by the same convention. */
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
