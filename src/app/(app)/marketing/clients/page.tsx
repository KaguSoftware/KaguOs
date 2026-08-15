import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { canWrite, requireSection } from "@/lib/data/session";
import { rowsOrThrow } from "@/lib/data/query";
import { PageHeader } from "@/components/shell/page-header";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { LinkButton } from "@/components/ui/link-button";
import { Panel } from "@/components/ui/panel";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { Client, ClientStatus, Creative } from "@/lib/types";

export const metadata: Metadata = { title: "Clients" };

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
 * The client list. At one or two pilot clients this is a short page, and it
 * should look like a short page: a row each, the count of what's live and
 * what's in flight, and a way in. It is deliberately not a grid of cards —
 * three cards in a twelve-column grid is a design pretending to have more
 * content than it has.
 */
export default async function ClientsPage() {
  const ctx = await requireSection("marketing");
  const writable = canWrite(ctx, "marketing");

  const [clients, creatives] = await Promise.all([
    rowsOrThrow(
      ctx.supabase
        .from("clients")
        .select("*")
        .eq("is_demo", ctx.showcase)
        .order("status")
        .order("name"),
      "clients"
    ),
    // Counting in SQL would need one query per client per state. The whole
    // table is small (one row per video, ever) and it is already being read for
    // the queue, so it is counted here instead — one round trip for the page.
    rowsOrThrow(
      ctx.supabase
        .from("creatives")
        .select("client_id, status")
        .eq("is_demo", ctx.showcase),
      "clients: creatives"
    ),
  ]);

  const rows = clients as Client[];
  const counts = new Map<string, { live: number; inFlight: number; waiting: number }>();
  for (const c of creatives as Pick<Creative, "client_id" | "status">[]) {
    const tally = counts.get(c.client_id) ?? { live: 0, inFlight: 0, waiting: 0 };
    if (c.status === "live") tally.live++;
    else tally.inFlight++;
    if (c.status === "client_review") tally.waiting++;
    counts.set(c.client_id, tally);
  }

  return (
    <>
      <LiveRefresh tables={["clients", "creatives"]} />
      <PageHeader
        title="Clients"
        description="Every video, campaign and lead in this section belongs to one of these."
        action={
          writable && (
            <LinkButton href="/marketing/clients/new" variant="primary">
              <Plus className="size-4" aria-hidden />
              New client
            </LinkButton>
          )
        }
      />

      {rows.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Building2}
            title="No clients yet"
            hint="A client is the root of everything here: their videos, their campaigns, their ad numbers, and the login their approver uses to sign off cuts."
            action={
              writable && (
                <LinkButton href="/marketing/clients/new" variant="primary">
                  Add the first one
                </LinkButton>
              )
            }
          />
        </Panel>
      ) : (
        <Panel>
          <ul className="divide-y divide-line">
            {rows.map((client) => {
              const tally = counts.get(client.id) ?? { live: 0, inFlight: 0, waiting: 0 };
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
                          ` · ${client.monthly_deliverables} videos a month`}
                        {client.ad_account_owner === "kagu" && " · Kagu ad account"}
                      </p>
                    </div>

                    {/* Numbers, not sentences. Right-aligned and mono so the eye
                        can run down the column and compare them. */}
                    <dl className="flex items-center gap-4 text-xs">
                      <Figure label="in flight" value={tally.inFlight} />
                      <Figure label="live" value={tally.live} />
                      {tally.waiting > 0 && (
                        <Figure label="with client" value={tally.waiting} tone="info" />
                      )}
                    </dl>

                    <Badge tone={STATUS_TONE[client.status]}>{client.status}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "info";
}) {
  return (
    <div className="text-right">
      <dd
        className={`font-mono text-sm tabular-nums ${tone === "info" ? "text-info" : "text-ink"}`}
      >
        {value}
      </dd>
      <dt className="text-[11px] text-faint">{label}</dt>
    </div>
  );
}
