import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Megaphone, Plus, Receipt } from "lucide-react";
import { canWrite, requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { TabbedPanels } from "@/components/shell/tabbed-panels";
import { LinkButton } from "@/components/ui/link-button";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { PostBoard } from "@/components/marketing/post-board";
import { Schedule } from "@/components/marketing/schedule";
import { BudgetPanel } from "@/components/marketing/budget";
import { CampaignList } from "@/components/marketing/campaigns";
import { ClientSettings } from "@/components/marketing/client-settings";
import { LinksPanel } from "@/components/marketing/links-panel";
import type {
  Client,
  FxRate,
  MarketingCampaign,
  MarketingLink,
  MarketingPost,
  Transaction,
} from "@/lib/types";

export const metadata: Metadata = { title: "Client" };

/**
 * ONE CLIENT, everything about them — this is the workspace the section's
 * whole redo exists for: their posts, their calendar, their campaigns, their
 * money, their links, and the standing notes about how they like things.
 */
export default async function ClientWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSection("marketing");
  const writable = canWrite(ctx, "marketing");

  const [{ data: client }, posts, campaigns, transactions, fxRates, links, members] =
    await Promise.all([
      selectOrThrow(
        ctx.supabase.from("clients").select("*").eq("id", id).maybeSingle(),
        "client"
      ),
      rowsOrThrow(
        ctx.supabase
          .from("marketing_posts")
          .select("*")
          .eq("client_id", id)
          .order("publish_on", { ascending: true, nullsFirst: false }),
        "client: posts"
      ),
      rowsOrThrow(
        ctx.supabase
          .from("marketing_campaigns")
          .select("*")
          .eq("client_id", id)
          .order("created_at", { ascending: false }),
        "client: campaigns"
      ),
      rowsOrThrow(
        ctx.supabase
          .from("transactions")
          .select("*")
          .eq("is_demo", ctx.showcase)
          .eq("category", "marketing")
          .eq("marketing_client_id", id)
          .order("occurred_on", { ascending: false })
          .limit(300),
        "client: transactions"
      ),
      rowsOrThrow(ctx.supabase.from("fx_rates").select("*"), "client: fx_rates"),
      rowsOrThrow(
        ctx.supabase
          .from("marketing_links")
          .select("*")
          .eq("client_id", id)
          .order("sort")
          .order("created_at"),
        "client: links"
      ),
      getMembersMap(ctx.supabase),
    ]);

  if (!client) notFound();
  const row = client as Client;
  const clientPosts = posts as MarketingPost[];
  const posted = clientPosts.filter((p) => p.status === "posted").length;

  const newPost = writable && (
    <LinkButton href={`/marketing/new-post?client=${id}`} variant="primary">
      <Plus className="size-4" aria-hidden />
      New post
    </LinkButton>
  );

  return (
    <>
      <LiveRefresh
        tables={["marketing_posts", "marketing_campaigns", "clients", "transactions", "marketing_links"]}
      />
      <TabbedPanels
        title={row.name}
        description={
          row.monthly_deliverables !== null
            ? `${row.monthly_deliverables} posts a month · ${posted} posted so far`
            : `${posted} posted so far`
        }
        ariaLabel="Client workspace"
        panels={[
          {
            key: "posts",
            label: "Posts",
            action: newPost,
            content:
              clientPosts.length === 0 ? (
                <Panel>
                  <EmptyState
                    icon={Megaphone}
                    title="No posts for this client yet"
                    hint="One row per thing that goes out: an idea, being made, dated and queued, out. The board tracks all four."
                    action={newPost}
                  />
                </Panel>
              ) : (
                <PostBoard posts={clientPosts} members={members} canWrite={writable} />
              ),
          },
          {
            key: "schedule",
            label: "Schedule",
            action: newPost,
            content: (
              <Schedule posts={clientPosts} members={members} canWrite={writable} />
            ),
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
            key: "budget",
            label: "Budget",
            action: writable && (
              <LinkButton href={`/marketing/new-expense?client=${id}`} variant="primary">
                <Receipt className="size-4" aria-hidden />
                Log expense
              </LinkButton>
            ),
            content: (
              <BudgetPanel
                transactions={transactions as Transaction[]}
                campaigns={campaigns as MarketingCampaign[]}
                fxRates={fxRates as FxRate[]}
                clientId={row.id}
              />
            ),
          },
          {
            key: "links",
            label: "Links",
            content: (
              <LinksPanel
                links={links as MarketingLink[]}
                canWrite={writable}
                clientId={row.id}
              />
            ),
          },
          {
            key: "notes",
            label: "Notes",
            content: <ClientSettings client={row} canWrite={writable} />,
          },
        ]}
      />
    </>
  );
}
