import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarDays, Plus, Receipt } from "lucide-react";
import { canWrite, requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { rowsOrThrow } from "@/lib/data/query";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { LinkButton } from "@/components/ui/link-button";
import { TabbedPanels } from "@/components/shell/tabbed-panels";
import { Overview } from "@/components/marketing/overview";
import { Schedule } from "@/components/marketing/schedule";
import { PipelineBoard } from "@/components/marketing/pipeline";
import { MyQueue } from "@/components/marketing/my-queue";
import { BudgetPanel } from "@/components/marketing/budget";
import { todayInIstanbul } from "@/lib/utils";
import type {
  Client,
  Creative,
  FxRate,
  MarketingCampaign,
  MarketingLink,
  Transaction,
} from "@/lib/types";

export const metadata: Metadata = { title: "Marketing" };

/**
 * THE MARKETING DASHBOARD — reshaped 2026-08-21 for the own-brand pivot.
 *
 * The old landing was My Queue, built for three people running client work.
 * Marketing Kagu's own brand opens with a different question — "how is our
 * marketing doing" — so the front door is a General overview, with the
 * calendar, the board, the personal queue and the money one tab away. Tabs
 * are TabbedPanels (the Finance page's pattern): everything renders in one
 * server pass, switching is instant local state.
 *
 * The client machinery (0062–0064) is intact underneath — all of this hangs
 * on the house client row (0068), and /marketing/clients still exists for the
 * day a real client returns.
 */
export default async function MarketingPage() {
  const ctx = await requireSection("marketing");
  const writable = canWrite(ctx, "marketing");
  const today = todayInIstanbul();

  // One wave. Everything on this page is independent, so it costs one round
  // trip rather than seven.
  const [creatives, clients, campaigns, transactions, fxRates, links, members] =
    await Promise.all([
      rowsOrThrow(
        ctx.supabase
          .from("creatives")
          .select("*")
          .eq("is_demo", ctx.showcase)
          .order("publish_on", { ascending: true, nullsFirst: false }),
        "marketing: creatives"
      ),
      rowsOrThrow(
        ctx.supabase
          .from("clients")
          .select("id, name, is_house")
          .eq("is_demo", ctx.showcase),
        "marketing: clients"
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
          .order("sort")
          .order("created_at"),
        "marketing: links"
      ),
      getMembersMap(ctx.supabase),
    ]);

  const rows = creatives as Creative[];
  const clientRows = clients as Pick<Client, "id" | "name" | "is_house">[];
  const houseId = clientRows.find((c) => c.is_house)?.id ?? null;
  // House behaviour (the shorter ladder) only while everything on screen is
  // ours — the moment a real client's rows exist, their cards must not carry
  // the shortcut.
  const house = houseId !== null && rows.every((c) => c.client_id === houseId);

  const notLive = rows.filter((c) => c.status !== "live");

  const newVideo = writable && (
    <LinkButton href="/marketing/new-creative" variant="primary">
      <Plus className="size-4" aria-hidden />
      New video
    </LinkButton>
  );

  return (
    <Suspense>
      <LiveRefresh
        tables={[
          "creatives",
          "clients",
          "marketing_campaigns",
          "transactions",
          "marketing_links",
        ]}
      />
      <TabbedPanels
        title="Marketing"
        description="Kagu's own brand — what's out, what's coming, what it costs."
        ariaLabel="Marketing subsections"
        panels={[
          {
            key: "general",
            label: "General",
            action: newVideo,
            content: (
              <Overview
                creatives={rows}
                transactions={transactions as Transaction[]}
                fxRates={fxRates as FxRate[]}
                links={links as MarketingLink[]}
                members={members}
                canWrite={writable}
              />
            ),
          },
          {
            key: "schedule",
            label: "Schedule",
            action: newVideo,
            content: (
              <Schedule
                creatives={rows}
                members={members}
                canWrite={writable}
                house={house}
              />
            ),
          },
          {
            key: "pipeline",
            label: "Pipeline",
            action: (
              <span className="flex gap-2">
                {writable && (
                  <LinkButton href="/marketing/shoot-week" variant="ghost">
                    <CalendarDays className="size-3.5" aria-hidden />
                    Shoot week
                  </LinkButton>
                )}
                {newVideo}
              </span>
            ),
            content: (
              <PipelineBoard
                creatives={notLive}
                members={members}
                canWrite={writable}
                house={house}
              />
            ),
          },
          {
            key: "queue",
            label: "My queue",
            action: newVideo,
            content: (
              <MyQueue
                creatives={notLive}
                members={members}
                userId={ctx.userId}
                today={today}
                canWrite={writable}
                house={house}
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
              />
            ),
          },
        ]}
      />
    </Suspense>
  );
}
