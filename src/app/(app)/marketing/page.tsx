import type { Metadata } from "next";
import { Suspense } from "react";
import { Plus, Receipt } from "lucide-react";
import { canWrite, requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { rowsOrThrow } from "@/lib/data/query";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { LinkButton } from "@/components/ui/link-button";
import { TabbedPanels } from "@/components/shell/tabbed-panels";
import { Overview } from "@/components/marketing/overview";
import { ClientList } from "@/components/marketing/client-list";
import { Schedule } from "@/components/marketing/schedule";
import { BudgetPanel } from "@/components/marketing/budget";
import type {
  Client,
  FxRate,
  MarketingCampaign,
  MarketingLink,
  MarketingPost,
  Transaction,
} from "@/lib/types";

export const metadata: Metadata = { title: "Marketing" };

/**
 * THE MARKETING DASHBOARD — rebuilt 2026-08-21, second pass.
 *
 * Kagu's marketing team working for other companies. The front door answers
 * "how is the work doing, across every client"; each client's own workspace
 * (posts, schedule, campaigns, budget, links, notes) is one click away from
 * the General tab's client rows. Tabs are TabbedPanels (the Finance page's
 * pattern): everything renders in one server pass, switching is local state.
 */
export default async function MarketingPage() {
  const ctx = await requireSection("marketing");
  const writable = canWrite(ctx, "marketing");

  // One wave. Everything on this page is independent, so it costs one round
  // trip rather than six.
  const [clients, posts, campaigns, transactions, fxRates, links, members] =
    await Promise.all([
      rowsOrThrow(
        ctx.supabase
          .from("clients")
          .select("*")
          .eq("is_demo", ctx.showcase)
          .order("status")
          .order("name"),
        "marketing: clients"
      ),
      rowsOrThrow(
        ctx.supabase
          .from("marketing_posts")
          .select("*")
          .eq("is_demo", ctx.showcase)
          .order("publish_on", { ascending: true, nullsFirst: false }),
        "marketing: posts"
      ),
      rowsOrThrow(
        ctx.supabase
          .from("marketing_campaigns")
          .select("*")
          .eq("is_demo", ctx.showcase)
          .order("created_at", { ascending: false }),
        "marketing: campaigns"
      ),
      rowsOrThrow(
        ctx.supabase
          .from("transactions")
          .select("*")
          .eq("is_demo", ctx.showcase)
          .eq("category", "marketing")
          .order("occurred_on", { ascending: false })
          .limit(300),
        "marketing: transactions"
      ),
      rowsOrThrow(ctx.supabase.from("fx_rates").select("*"), "marketing: fx_rates"),
      rowsOrThrow(
        ctx.supabase
          .from("marketing_links")
          .select("*")
          .eq("is_demo", ctx.showcase)
          .is("client_id", null)
          .order("sort")
          .order("created_at"),
        "marketing: links"
      ),
      getMembersMap(ctx.supabase),
    ]);

  const clientRows = clients as Client[];
  const postRows = posts as MarketingPost[];

  const clientNames: Record<string, string> = {};
  for (const c of clientRows) clientNames[c.id] = c.name;

  const newPost = writable && (
    <LinkButton href="/marketing/new-post" variant="primary">
      <Plus className="size-4" aria-hidden />
      New post
    </LinkButton>
  );

  return (
    <Suspense>
      <LiveRefresh
        tables={[
          "marketing_posts",
          "clients",
          "marketing_campaigns",
          "transactions",
          "marketing_links",
        ]}
      />
      <TabbedPanels
        title="Marketing"
        description="The clients, what's going out for them, and what it costs."
        ariaLabel="Marketing subsections"
        panels={[
          {
            key: "general",
            label: "General",
            action: newPost,
            content: (
              <Overview
                clients={clientRows}
                posts={postRows}
                transactions={transactions as Transaction[]}
                fxRates={fxRates as FxRate[]}
                links={links as MarketingLink[]}
                members={members}
                canWrite={writable}
              />
            ),
          },
          {
            key: "clients",
            label: "Clients",
            action: writable && (
              <LinkButton href="/marketing/clients/new" variant="primary">
                <Plus className="size-4" aria-hidden />
                New client
              </LinkButton>
            ),
            content: <ClientList clients={clientRows} posts={postRows} />,
          },
          {
            key: "schedule",
            label: "Schedule",
            action: newPost,
            content: (
              <Schedule
                posts={postRows}
                members={members}
                canWrite={writable}
                clientNames={clientNames}
              />
            ),
          },
          {
            key: "budget",
            label: "Budget",
            action: writable && (
              <LinkButton href="/marketing/new-expense" variant="primary">
                <Receipt className="size-4" aria-hidden />
                Log expense
              </LinkButton>
            ),
            content: (
              <BudgetPanel
                transactions={transactions as Transaction[]}
                campaigns={campaigns as MarketingCampaign[]}
                fxRates={fxRates as FxRate[]}
                clientNames={clientNames}
              />
            ),
          },
        ]}
      />
    </Suspense>
  );
}
