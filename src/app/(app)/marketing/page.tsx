import type { Metadata } from "next";
import { Suspense } from "react";
import { requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { rowsOrThrow } from "@/lib/data/query";
import { MarketingWorkspace } from "@/components/marketing/workspace";
import { LiveRefresh } from "@/components/shell/live-refresh";
import type {
  MarketingCampaign,
  MarketingItem,
  MarketingPost,
} from "@/lib/types";

export const metadata: Metadata = { title: "Marketing" };

const STATUS_ORDER = { running: 0, planned: 1, idea: 2, done: 3 } as const;

export default async function MarketingPage() {
  const ctx = await requireSection("marketing");

  const [campaigns, posts, links, members] = await Promise.all([
    rowsOrThrow(
      ctx.supabase
        .from("marketing_campaigns")
        .select("*")
        .eq("is_demo", ctx.showcase)
        .order("created_at", { ascending: false }),
      "marketing_campaigns"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("marketing_posts")
        .select("*")
        .eq("is_demo", ctx.showcase)
        .order("publish_on", { ascending: true, nullsFirst: false }),
      "marketing_posts"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("marketing_items")
        .select("*")
        .eq("is_demo", ctx.showcase)
        .order("created_at", { ascending: false }),
      "marketing_items"
    ),
    getMembersMap(ctx.supabase),
  ]);

  const campaignRows = campaigns as MarketingCampaign[];
  campaignRows.sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  );

  const campaignNames: Record<string, string> = {};
  for (const c of campaignRows) campaignNames[c.id] = c.name;

  return (
    <Suspense>
      <LiveRefresh tables={["marketing_campaigns", "marketing_posts", "marketing_items"]} />
      <MarketingWorkspace
        campaigns={campaignRows}
        posts={posts as MarketingPost[]}
        links={links as MarketingItem[]}
        members={members}
        campaignNames={campaignNames}
      />
    </Suspense>
  );
}
