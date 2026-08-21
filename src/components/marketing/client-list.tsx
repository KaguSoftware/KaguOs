import Link from "next/link";
import { Building2 } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { Client, ClientStatus, MarketingPost } from "@/lib/types";

const STATUS_TONE: Record<ClientStatus, BadgeTone> = {
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
 * The full client roster — including paused and ended, which the General
 * overview drops. A row each, the counts that matter, and a way in. Not a
 * grid of cards: three cards in a twelve-column grid is a design pretending
 * to have more content than it has.
 */
export function ClientList({
  clients,
  posts,
}: {
  clients: Client[];
  posts: Pick<MarketingPost, "client_id" | "status">[];
}) {
  const counts = new Map<string, { inFlight: number; posted: number }>();
  for (const p of posts) {
    const tally = counts.get(p.client_id) ?? { inFlight: 0, posted: 0 };
    if (p.status === "posted") tally.posted++;
    else tally.inFlight++;
    counts.set(p.client_id, tally);
  }

  if (clients.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={Building2}
          title="No clients yet"
          hint="A client is the root of everything here: their posts, their campaigns, their budget. Add the first one."
        />
      </Panel>
    );
  }

  return (
    <Panel>
      <ul className="divide-y divide-line">
        {clients.map((client) => {
          const tally = counts.get(client.id) ?? { inFlight: 0, posted: 0 };
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
                    {client.ad_account_owner === "kagu" && " · Kagu ad account"}
                  </p>
                </div>

                {/* Numbers, not sentences. Mono and right-aligned so the eye
                    can run down the column and compare them. */}
                <dl className="flex items-center gap-4 text-xs">
                  <Figure label="in flight" value={tally.inFlight} />
                  <Figure label="posted" value={tally.posted} />
                </dl>

                <Badge tone={STATUS_TONE[client.status]}>{client.status}</Badge>
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <dd className="font-mono text-sm text-ink tabular-nums">{value}</dd>
      <dt className="text-[calc(11px*var(--text-scale,1))] text-faint">{label}</dt>
    </div>
  );
}
