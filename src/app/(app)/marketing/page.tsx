import type { Metadata } from "next";
import { Suspense } from "react";
import { Clapperboard, Plus } from "lucide-react";
import { canWrite, requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { rowsOrThrow } from "@/lib/data/query";
import { PageHeader } from "@/components/shell/page-header";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { LinkButton } from "@/components/ui/link-button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { CreativeCard } from "@/components/marketing/creative-card";
import { todayInIstanbul } from "@/lib/utils";
import type { Client, Creative } from "@/lib/types";

export const metadata: Metadata = { title: "Marketing" };

/**
 * MY QUEUE — the section's front door, and the screen the plan says to build
 * first.
 *
 * Three people share this work and hand videos between them. The question they
 * open the app to ask is not "how is the pipeline doing", it is "what is on
 * me". So the landing page is a personal work list, not a dashboard: the
 * pipeline board lives one click away, inside the client it belongs to.
 *
 * Four groups, in the order they should be dealt with. The order is the whole
 * design — a single flat list sorted by date would bury a video the client sent
 * back under six ideas nobody has started.
 */
export default async function MarketingPage() {
  const ctx = await requireSection("marketing");
  const writable = canWrite(ctx, "marketing");
  const today = todayInIstanbul();

  // One wave. Everything on this page is independent, so it costs one round
  // trip rather than four.
  const [creatives, clients, members] = await Promise.all([
    rowsOrThrow(
      ctx.supabase
        .from("creatives")
        .select("*")
        .eq("is_demo", ctx.showcase)
        .neq("status", "live")
        .order("publish_on", { ascending: true, nullsFirst: false }),
      "marketing: creatives"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("clients")
        .select("id, name")
        .eq("is_demo", ctx.showcase),
      "marketing: clients"
    ),
    getMembersMap(ctx.supabase),
  ]);

  const rows = creatives as Creative[];
  const clientNames: Record<string, string> = {};
  for (const c of clients as Pick<Client, "id" | "name">[]) clientNames[c.id] = c.name;

  // A STRICT PARTITION: every video lands in exactly one group, decided by the
  // first rule that matches. Written as one pass rather than four filters
  // because four independent filters overlap — a video of mine that the client
  // sent back and that is also past its date would appear three times, and a
  // queue that double-counts is a queue nobody trusts the numbers on.
  //
  // The order of the rules IS the priority order of the work.
  const sentBack: Creative[] = [];
  const overdue: Creative[] = [];
  const waitingOnClient: Creative[] = [];
  const mine: Creative[] = [];

  for (const creative of rows) {
    const isMine =
      creative.owner_id === ctx.userId || creative.editor_id === ctx.userId;
    const isLate = creative.publish_on !== null && creative.publish_on < today;

    // "Blocked" means blocked ON THE CLIENT, which is the only kind of blocked
    // this pipeline has: everything else is somebody at Kagu not having done it
    // yet, and that is what the other groups are for. Both client-held states
    // are shown to the whole team, not just the owner — a video sitting with a
    // client is everyone's problem to chase.
    if (creative.status === "changes_requested") sentBack.push(creative);
    else if (isMine && isLate) overdue.push(creative);
    else if (creative.status === "client_review") waitingOnClient.push(creative);
    else if (isMine) mine.push(creative);
    // Anything else belongs to a colleague and is not late: it is on their
    // queue, and showing it here would make this page a second board.
  }

  const empty = rows.length === 0;

  return (
    <Suspense>
      <LiveRefresh tables={["creatives", "clients"]} />
      <PageHeader
        title="Marketing"
        description="What's on you, across every client."
        action={
          writable && (
            <div className="flex gap-2">
              <LinkButton href="/marketing/shoot-week" variant="ghost">
                Shoot week
              </LinkButton>
              <LinkButton href="/marketing/clients" variant="ghost">
                Clients
              </LinkButton>
              <LinkButton href="/marketing/new-creative" variant="primary">
                <Plus className="size-4" aria-hidden />
                New video
              </LinkButton>
            </div>
          )
        }
      />

      {empty ? (
        <Panel>
          <EmptyState
            icon={Clapperboard}
            title="No videos yet"
            hint="This section runs client video work: one row per video, from idea through the shoot and the edit to the client's approval and the post going live. Add a client first, then the videos you owe them."
            action={
              writable && (
                <LinkButton href="/marketing/clients/new" variant="primary">
                  Add a client
                </LinkButton>
              )
            }
          />
        </Panel>
      ) : (
        <div className="space-y-5">
          <QueueGroup
            title="Sent back"
            hint="The client asked for changes. These come first."
            rows={sentBack}
            members={members}
            clientNames={clientNames}
            canWrite={writable}
          />
          <QueueGroup
            title="Overdue"
            hint="Past their publish date and not live."
            rows={overdue}
            members={members}
            clientNames={clientNames}
            canWrite={writable}
          />
          <QueueGroup
            title="Yours"
            hint="You're the producer or the editor."
            rows={mine}
            members={members}
            clientNames={clientNames}
            canWrite={writable}
            emptyLine="Nothing on you right now. Everything else is on the client boards."
          />
          <QueueGroup
            title="With the client"
            hint="Waiting on someone else. Nothing to do but chase."
            rows={waitingOnClient}
            members={members}
            clientNames={clientNames}
            canWrite={writable}
          />
        </div>
      )}
    </Suspense>
  );
}

/**
 * A group renders nothing at all when it is empty — with one exception. "Sent
 * back" and "Overdue" are alarms: their absence is the good state and drawing
 * an empty panel for them would put two permanent "all clear" boxes at the top
 * of the page, which is exactly the noise a queue screen must not have. "Yours"
 * is different: an empty personal list is information, so it says so.
 */
function QueueGroup({
  title,
  hint,
  rows,
  members,
  clientNames,
  canWrite,
  emptyLine,
}: {
  title: string;
  hint: string;
  rows: Creative[];
  members: Awaited<ReturnType<typeof getMembersMap>>;
  clientNames: Record<string, string>;
  canWrite: boolean;
  emptyLine?: string;
}) {
  if (rows.length === 0 && !emptyLine) return null;

  return (
    <Panel>
      <PanelHeader
        title={
          <span className="flex items-baseline gap-2">
            {title}
            <span className="font-mono text-xs font-normal text-faint tabular-nums">
              {rows.length}
            </span>
          </span>
        }
        action={<span className="text-xs text-faint">{hint}</span>}
      />
      {rows.length === 0 ? (
        <p className="px-4 py-5 text-[13px] text-faint">{emptyLine}</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((creative) => (
            <li key={creative.id}>
              <CreativeCard
                creative={creative}
                members={members}
                clientName={clientNames[creative.client_id]}
                canWrite={canWrite}
              />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
