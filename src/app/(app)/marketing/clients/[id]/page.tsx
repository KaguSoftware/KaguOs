import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Megaphone, Plus } from "lucide-react";
import { canWrite, requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { TabbedPanels } from "@/components/shell/tabbed-panels";
import { LinkButton } from "@/components/ui/link-button";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { PipelineBoard } from "@/components/marketing/pipeline";
import { ShootWeek } from "@/components/marketing/shoot-week";
import { CampaignList } from "@/components/marketing/campaigns";
import { ClientSettings } from "@/components/marketing/client-settings";
import { ClientAccess, type ClientPerson } from "@/components/marketing/client-access";
import type { Client, Creative, MarketingCampaign } from "@/lib/types";

export const metadata: Metadata = { title: "Client" };

/**
 * ONE CLIENT, everything about them.
 *
 * At one or two pilot clients a switcher would do and "client" does not need to
 * be a nav-level concept — but the workspace does, because the tabs here are
 * the section's real structure: the pipeline, the shoot calendar, the money
 * that ran against it, and the standing notes about how this client likes
 * things. Ads and Leads join this row in a later phase; the tab list is built
 * from what exists rather than showing empty tabs as promises.
 */
export default async function ClientWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSection("marketing");
  const writable = canWrite(ctx, "marketing");

  const [{ data: client }, creatives, campaigns, members, people] = await Promise.all([
    selectOrThrow(
      ctx.supabase.from("clients").select("*").eq("id", id).maybeSingle(),
      "client"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("creatives")
        .select("*")
        .eq("client_id", id)
        .order("updated_at", { ascending: false }),
      "client: creatives"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("marketing_campaigns")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
      "client: campaigns"
    ),
    getMembersMap(ctx.supabase),
    // Who at this client can sign in. Joined through to `profiles` because
    // client accounts are deliberately absent from getMembersMap — that map is
    // "who is a colleague", and these people are not (0062).
    rowsOrThrow(
      ctx.supabase
        .from("client_users")
        .select("user_id, role, profiles(full_name, email)")
        .eq("client_id", id),
      "client: people"
    ),
  ]);

  if (!client) notFound();
  const row = client as Client;
  const videos = creatives as Creative[];

  // PostgREST types an embedded relation as an array even when the foreign key
  // makes it one-to-one (client_users.user_id is both FK and primary key, so
  // there is exactly one profile). Normalised here rather than asserted, so a
  // future schema change that genuinely makes it many doesn't read undefined.
  type PersonRow = {
    user_id: string;
    role: ClientPerson["role"];
    profiles:
      | { full_name: string | null; email: string }
      | { full_name: string | null; email: string }[]
      | null;
  };
  const clientPeople: ClientPerson[] = (people as PersonRow[]).map((p) => {
    const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
    return {
      user_id: p.user_id,
      role: p.role,
      name: profile?.full_name || profile?.email || "Client user",
      email: profile?.email ?? "",
    };
  });

  const newVideo = writable && (
    <LinkButton href={`/marketing/new-creative?client=${id}`} variant="primary">
      <Plus className="size-4" aria-hidden />
      New video
    </LinkButton>
  );

  return (
    <>
      <LiveRefresh tables={["creatives", "marketing_campaigns", "clients"]} />
      <TabbedPanels
        title={row.name}
        description={
          row.monthly_deliverables !== null
            ? `${row.monthly_deliverables} videos a month · ${videos.filter((v) => v.status === "live").length} live so far`
            : `${videos.filter((v) => v.status === "live").length} live so far`
        }
        ariaLabel="Client workspace"
        panels={[
          {
            key: "pipeline",
            label: "Pipeline",
            action: newVideo,
            content:
              videos.length === 0 ? (
                <Panel>
                  <EmptyState
                    icon={Megaphone}
                    title="No videos for this client yet"
                    hint="Every video starts as an idea and moves one step at a time: scripted, shot, edited, checked internally, then sent to the client to sign off."
                    action={newVideo}
                  />
                </Panel>
              ) : (
                <PipelineBoard
                  creatives={videos}
                  members={members}
                  canWrite={writable}
                />
              ),
          },
          {
            key: "calendar",
            label: "Shoot week",
            action: newVideo,
            content: <ShootWeek creatives={videos} members={members} />,
          },
          {
            key: "campaigns",
            label: "Campaigns",
            action: writable && (
              <LinkButton href={`/marketing/new-campaign?client=${id}`} variant="primary">
                <Plus className="size-4" aria-hidden />
                New campaign
              </LinkButton>
            ),
            content: (
              <CampaignList
                campaigns={campaigns as MarketingCampaign[]}
                canWrite={writable}
              />
            ),
          },
          {
            key: "notes",
            label: "Notes",
            content: <ClientSettings client={row} canWrite={writable} />,
          },
          {
            key: "access",
            label: "Access",
            content: (
              <ClientAccess
                clientId={row.id}
                people={clientPeople}
                canWrite={writable}
              />
            ),
          },
        ]}
      />
    </>
  );
}
